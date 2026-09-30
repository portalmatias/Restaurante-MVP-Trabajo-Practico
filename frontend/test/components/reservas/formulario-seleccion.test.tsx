import { fireEvent, render, screen, within } from "@testing-library/react";
import { FormularioSeleccion } from "../../../src/components/reservas/formulario-seleccion";
import {
  TURNO_ALMUERZO_SABADO,
  TURNO_CENA_MARTES,
  TURNO_CENA_SABADO,
  TURNOS,
  ZONA_STANDARD,
  ZONA_VIP,
  ZONAS,
} from "../../fixtures/reservas";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Hoy en Argentina: lunes 2026-09-14 (12:00 local). Solo se falsea `Date`: el resto de los
// temporizadores quedan reales para no interferir con Testing Library.
const AHORA = new Date("2026-09-14T15:00:00.000Z");
const SABADO = "2026-09-19";
const LUNES = "2026-09-21";
const MARTES = "2026-09-15";

const SIN_FALSEAR = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

beforeEach(() => {
  push.mockReset();
  jest.useFakeTimers({ now: AHORA, doNotFake: [...SIN_FALSEAR] });
});

afterEach(() => {
  jest.useRealTimers();
});

type Inicial = Parameters<typeof FormularioSeleccion>[0]["seleccionInicial"];

function renderizar(seleccionInicial?: Inicial) {
  return render(
    <FormularioSeleccion zonas={ZONAS} turnos={TURNOS} seleccionInicial={seleccionInicial} />,
  );
}

const campoFecha = () => screen.getByLabelText("Fecha") as HTMLInputElement;
const campoTurno = () => screen.getByLabelText("Turno") as HTMLSelectElement;
const opcionZona = (nombre: string) => screen.getByRole("radio", { name: new RegExp(nombre) });
const botonVer = () => screen.getByRole("button", { name: "Ver disponibilidad" });
const cantidad = () => screen.getByRole("status", { name: "Cantidad de comensales" });
const masComensales = () => screen.getByRole("button", { name: "Más comensales" });
const menosComensales = () => screen.getByRole("button", { name: "Menos comensales" });

function elegirFecha(fecha: string) {
  fireEvent.change(campoFecha(), { target: { value: fecha } });
}

function elegirTurno(id: string) {
  fireEvent.change(campoTurno(), { target: { value: id } });
}

function elegirZona(nombre: string) {
  fireEvent.click(opcionZona(nombre));
}

describe("FormularioSeleccion - campos y obligatoriedad", () => {
  it("muestra la fecha, el turno, la zona, los comensales y el botón de continuar", () => {
    renderizar();

    expect(campoFecha()).toHaveAttribute("type", "date");
    expect(campoTurno()).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Zona" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Comensales" })).toBeInTheDocument();
    expect(botonVer()).toBeInTheDocument();
  });

  it("muestra el paso 1 de 3 y el título del paso", () => {
    renderizar();

    expect(screen.getByText("Paso 1 de 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "¿Cuándo y para cuántos?" }),
    ).toBeInTheDocument();
  });

  it("deshabilita 'Ver disponibilidad' y lista lo que falta en una región aria-live polite", () => {
    renderizar();

    expect(botonVer()).toBeDisabled();
    const faltante = screen.getByText("Falta elegir: fecha, turno y zona");
    expect(faltante.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("actualiza lo que falta a medida que se completan los campos", () => {
    renderizar();

    elegirFecha(SABADO);
    expect(screen.getByText("Falta elegir: turno y zona")).toBeInTheDocument();

    elegirTurno(TURNO_CENA_SABADO.id);
    expect(screen.getByText("Falta elegir: zona")).toBeInTheDocument();
    expect(botonVer()).toBeDisabled();
  });

  it("con los cuatro campos completos habilita el botón y quita el texto", () => {
    renderizar();

    elegirFecha(SABADO);
    elegirTurno(TURNO_CENA_SABADO.id);
    elegirZona("STANDARD");

    expect(botonVer()).toBeEnabled();
    expect(screen.queryByText(/Falta elegir/)).not.toBeInTheDocument();
  });

  it("señala la fecha faltante si se borra después de completar todo", () => {
    renderizar({ fecha: SABADO, turnoId: TURNO_CENA_SABADO.id, zonaId: ZONA_STANDARD.id, comensales: "2" });
    expect(botonVer()).toBeEnabled();

    elegirFecha("");

    expect(botonVer()).toBeDisabled();
    expect(screen.getByText("Falta elegir: fecha y turno")).toBeInTheDocument();
  });
});

describe("FormularioSeleccion - fecha", () => {
  it("usa como mínimo el día de hoy en el calendario del restaurante", () => {
    renderizar();

    expect(campoFecha()).toHaveAttribute("min", "2026-09-14");
  });

  it("calcula el mínimo con el offset de Argentina, no con el día UTC", () => {
    // 02:00 UTC del 15 sigue siendo el 14 a las 23:00 en Argentina.
    jest.setSystemTime(new Date("2026-09-15T02:00:00.000Z"));
    renderizar();

    expect(campoFecha()).toHaveAttribute("min", "2026-09-14");
  });

  it("señala una fecha anterior a hoy escrita a mano y no ofrece turnos", () => {
    renderizar();

    elegirFecha("2026-09-13");

    expect(screen.getByText("Elegí una fecha desde hoy.")).toBeInTheDocument();
    expect(campoTurno()).toBeDisabled();
  });
});

describe("FormularioSeleccion - turnos del día", () => {
  it("deshabilita el turno hasta elegir la fecha", () => {
    renderizar();

    expect(campoTurno()).toBeDisabled();
  });

  it("un sábado ofrece solo los turnos del sábado, con el horario local", () => {
    renderizar();

    elegirFecha(SABADO);

    const opciones = within(campoTurno())
      .getAllByRole("option")
      .filter((opcion) => (opcion as HTMLOptionElement).value !== "")
      .map((opcion) => [(opcion as HTMLOptionElement).value, opcion.textContent]);
    expect(opciones).toEqual([
      [TURNO_ALMUERZO_SABADO.id, "12:00 a 15:00"],
      [TURNO_CENA_SABADO.id, "20:00 a 23:30"],
    ]);
  });

  it("un lunes sin turnos activos muestra el aviso y oculta el selector de turno", () => {
    renderizar();

    elegirFecha(LUNES);

    expect(screen.getByText("No hay turnos disponibles ese día. Elegí otra fecha.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
  });

  it("cambiar la fecha a otro día limpia el turno que ya no corresponde", () => {
    renderizar();
    elegirFecha(SABADO);
    elegirTurno(TURNO_CENA_SABADO.id);
    expect(campoTurno()).toHaveValue(TURNO_CENA_SABADO.id);

    elegirFecha(MARTES);

    expect(campoTurno()).toHaveValue("");
    expect(screen.getByText(/Falta elegir: turno/)).toBeInTheDocument();
  });

  it("cambiar la fecha a otra del mismo día de la semana conserva el turno", () => {
    renderizar();
    elegirFecha(SABADO);
    elegirTurno(TURNO_CENA_SABADO.id);

    elegirFecha("2026-09-26");

    expect(campoTurno()).toHaveValue(TURNO_CENA_SABADO.id);
  });
});

describe("FormularioSeleccion - zona", () => {
  it("la zona VIP muestra comensales, anticipación y que queda pendiente de confirmación", () => {
    renderizar();

    const vip = opcionZona("VIP");
    expect(within(vip).getByText("2 a 12 comensales")).toBeInTheDocument();
    expect(within(vip).getByText(/24 horas a 60 días/)).toBeInTheDocument();
    expect(within(vip).getByText("Queda pendiente de confirmación")).toBeInTheDocument();
  });

  it("la zona STANDARD muestra comensales y anticipación, sin pendiente de confirmación", () => {
    renderizar();

    const standard = opcionZona("STANDARD");
    expect(within(standard).getByText("1 a 8 comensales")).toBeInTheDocument();
    expect(within(standard).getByText(/2 horas a 30 días/)).toBeInTheDocument();
    expect(within(standard).queryByText(/pendiente de confirmación/)).not.toBeInTheDocument();
  });

  it("marca con aria-checked solo la zona elegida", () => {
    renderizar();

    elegirZona("VIP");

    expect(opcionZona("VIP")).toHaveAttribute("aria-checked", "true");
    expect(opcionZona("STANDARD")).toHaveAttribute("aria-checked", "false");
  });
});

describe("FormularioSeleccion - comensales", () => {
  it("está deshabilitado hasta elegir la zona", () => {
    renderizar();

    expect(masComensales()).toBeDisabled();
    expect(menosComensales()).toBeDisabled();
  });

  it("al elegir una zona parte del mínimo de esa zona", () => {
    renderizar();

    elegirZona("VIP");

    expect(cantidad()).toHaveTextContent("2");
  });

  it("no permite bajar del mínimo ni subir del máximo de la zona VIP", () => {
    renderizar();
    elegirZona("VIP");

    expect(menosComensales()).toBeDisabled();
    for (let i = 0; i < 10; i += 1) fireEvent.click(masComensales());

    expect(cantidad()).toHaveTextContent("12");
    expect(masComensales()).toBeDisabled();
    expect(menosComensales()).toBeEnabled();
  });

  it("cambiar de STANDARD (1 comensal) a VIP ajusta la cantidad a 2", () => {
    renderizar();
    elegirZona("STANDARD");
    expect(cantidad()).toHaveTextContent("1");

    elegirZona("VIP");

    expect(cantidad()).toHaveTextContent("2");
  });

  it("cambiar de VIP (12 comensales) a STANDARD ajusta la cantidad a 8", () => {
    renderizar({ zonaId: ZONA_VIP.id, comensales: "12" });
    expect(cantidad()).toHaveTextContent("12");

    elegirZona("STANDARD");

    expect(cantidad()).toHaveTextContent("8");
  });

  it("baja y sube de a un comensal", () => {
    renderizar({ zonaId: ZONA_STANDARD.id, comensales: "4" });

    fireEvent.click(masComensales());
    expect(cantidad()).toHaveTextContent("5");
    fireEvent.click(menosComensales());
    fireEvent.click(menosComensales());
    expect(cantidad()).toHaveTextContent("3");
  });
});

describe("FormularioSeleccion - selección inicial", () => {
  it("prellena los cuatro controles con una selección válida", () => {
    renderizar({
      fecha: SABADO,
      turnoId: TURNO_CENA_SABADO.id,
      zonaId: ZONA_VIP.id,
      comensales: "6",
    });

    expect(campoFecha()).toHaveValue(SABADO);
    expect(campoTurno()).toHaveValue(TURNO_CENA_SABADO.id);
    expect(opcionZona("VIP")).toHaveAttribute("aria-checked", "true");
    expect(cantidad()).toHaveTextContent("6");
    expect(botonVer()).toBeEnabled();
  });

  it("ignora un turnoId que no está en GET /turnos", () => {
    renderizar({ fecha: SABADO, turnoId: "no-existe", zonaId: ZONA_VIP.id, comensales: "6" });

    expect(campoFecha()).toHaveValue(SABADO);
    expect(campoTurno()).toHaveValue("");
    expect(opcionZona("VIP")).toHaveAttribute("aria-checked", "true");
    expect(cantidad()).toHaveTextContent("6");
  });

  it("ignora un zonaId que no está en GET /zonas, y con él los comensales", () => {
    renderizar({ fecha: SABADO, turnoId: TURNO_CENA_SABADO.id, zonaId: "no-existe", comensales: "6" });

    expect(campoTurno()).toHaveValue(TURNO_CENA_SABADO.id);
    expect(screen.getAllByRole("radio").every((r) => r.getAttribute("aria-checked") === "false")).toBe(true);
    expect(masComensales()).toBeDisabled();
    expect(screen.getByText("Falta elegir: zona")).toBeInTheDocument();
  });

  it.each([
    ["mal formada", "19/09/2026"],
    ["inexistente en el calendario", "2026-02-30"],
    ["anterior a hoy", "2026-09-13"],
  ])("ignora una fecha %s y, con ella, el turno", (_motivo, fecha) => {
    renderizar({ fecha, turnoId: TURNO_CENA_SABADO.id, zonaId: ZONA_STANDARD.id, comensales: "2" });

    expect(campoFecha()).toHaveValue("");
    expect(campoTurno()).toHaveValue("");
    expect(campoTurno()).toBeDisabled();
    expect(opcionZona("STANDARD")).toHaveAttribute("aria-checked", "true");
  });

  it("ignora un turnoId existente pero de otro día de la semana que la fecha", () => {
    renderizar({ fecha: SABADO, turnoId: TURNO_CENA_MARTES.id, zonaId: ZONA_STANDARD.id, comensales: "2" });

    expect(campoFecha()).toHaveValue(SABADO);
    expect(campoTurno()).toHaveValue("");
  });

  it.each([
    ["no entero", "2.5"],
    ["no numérico", "muchos"],
    ["menor que el mínimo de la zona", "1"],
    ["mayor que el máximo de la zona", "13"],
  ])("ignora unos comensales %s sin acotarlos", (_motivo, comensales) => {
    renderizar({ fecha: SABADO, turnoId: TURNO_CENA_SABADO.id, zonaId: ZONA_VIP.id, comensales });

    expect(opcionZona("VIP")).toHaveAttribute("aria-checked", "true");
    expect(cantidad()).not.toHaveTextContent(/\d/);
    expect(screen.getByText("Falta elegir: comensales")).toBeInTheDocument();
    expect(botonVer()).toBeDisabled();
  });

  it("con comensales sin cargar, '+' parte del mínimo de la zona", () => {
    renderizar({ zonaId: ZONA_VIP.id });

    fireEvent.click(masComensales());

    expect(cantidad()).toHaveTextContent("2");
  });
});

describe("FormularioSeleccion - envío", () => {
  it("arma la URL del resultado con los cuatro parámetros y navega", () => {
    renderizar();
    elegirFecha(SABADO);
    elegirTurno(TURNO_CENA_SABADO.id);
    elegirZona("VIP");
    fireEvent.click(masComensales());

    fireEvent.click(botonVer());

    const esperada = new URLSearchParams({
      fecha: SABADO,
      turnoId: TURNO_CENA_SABADO.id,
      zonaId: ZONA_VIP.id,
      comensales: "3",
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(`/reservas/nueva/resultado?${esperada.toString()}`);
  });

  it("no navega si falta algún campo", () => {
    renderizar({ fecha: SABADO });

    fireEvent.submit(botonVer().closest("form") as HTMLFormElement);

    expect(push).not.toHaveBeenCalled();
  });
});
