import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { Calendario, sumarDias } from "../../../src/components/ui/calendario";
import type { DiaSemana } from "../../../src/lib/fecha-hora";

// Tarea 3.9: cada escenario de la capability calendario-fecha. «Hoy» llega por prop, como en
// producción: el lunes 14 de septiembre de 2026 salvo que el caso diga otra cosa.
const HOY = "2026-09-14";
// Como el seed: martes a domingo con turnos, el lunes cerrado.
const SIN_LUNES: ReadonlySet<DiaSemana> = new Set(["MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"]);
const TODOS: ReadonlySet<DiaSemana> = new Set([...SIN_LUNES, "LUNES"]);

function Asistente({
  hoy = HOY,
  hasta,
  dias = SIN_LUNES,
  onChange,
}: {
  hoy?: string;
  hasta?: string;
  dias?: ReadonlySet<DiaSemana>;
  onChange?: (fecha: string) => void;
}) {
  const [fecha, setFecha] = useState("");
  return (
    <Calendario
      value={fecha}
      hoy={hoy}
      hasta={hasta}
      diasConTurnos={dias}
      onChange={(nueva) => {
        setFecha(nueva);
        onChange?.(nueva);
      }}
    />
  );
}

const dia = (iso: string) => {
  const boton = document.querySelector<HTMLButtonElement>(`button[data-fecha="${iso}"]`);
  if (!boton) throw new Error(`El calendario no muestra el día ${iso}.`);
  return boton;
};
const diasVisibles = () => document.querySelectorAll("button[data-fecha]");
const enfocado = () => document.activeElement?.getAttribute("data-fecha");
const mesSiguiente = () => screen.getByRole("button", { name: "Mes siguiente" });
const mesAnterior = () => screen.getByRole("button", { name: "Mes anterior" });

describe("Calendario - estructura del mes", () => {
  it("la semana empieza el lunes: un mes que empieza en miércoles deja dos celdas vacías", () => {
    // 1 de julio de 2026 cae en miércoles.
    expect(new Date(Date.UTC(2026, 6, 1)).getUTCDay()).toBe(3);
    render(<Asistente hoy="2026-07-01" />);

    const encabezados = screen.getAllByRole("columnheader");
    ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"].forEach((nombre, i) => {
      expect(encabezados[i]).toHaveAccessibleName(nombre);
    });
    const primeraSemana = within(screen.getByRole("table")).getAllByRole("row")[1];
    const celdas = within(primeraSemana).getAllByRole("cell");
    expect(celdas[0]).toBeEmptyDOMElement();
    expect(celdas[1]).toBeEmptyDOMElement();
    expect(within(celdas[2]).getByRole("button")).toHaveAttribute("data-fecha", "2026-07-01");
  });

  it("los encabezados se leen con el día completo; la abreviatura y el kanji son decorativos", () => {
    render(<Asistente />);
    const lunes = screen.getAllByRole("columnheader")[0];

    expect(lunes).toHaveAccessibleName("lunes");
    expect(within(lunes).getByText("lun")).toHaveAttribute("aria-hidden", "true");
    expect(within(lunes).getByText("月")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    ["septiembre de 2026", 0, 30],
    ["octubre de 2026", 1, 31],
    ["febrero de 2027", 5, 28],
  ])("%s (a %i meses de hoy) muestra %i días", (_mes, avances, cantidad) => {
    render(<Asistente />);

    for (let i = 0; i < avances; i += 1) fireEvent.click(mesSiguiente());

    expect(diasVisibles()).toHaveLength(cantidad);
  });
});

describe("Calendario - días no elegibles", () => {
  it("un día pasado es aria-disabled y termina en «, no disponible»", () => {
    render(<Asistente />);

    expect(dia("2026-09-13")).toHaveAttribute("aria-disabled", "true");
    expect(dia("2026-09-13")).toHaveAccessibleName("domingo 13 de septiembre de 2026, no disponible");
  });

  it("un día de la semana sin turnos es aria-disabled, termina en «, cerrado» y va tachado", () => {
    render(<Asistente />);

    expect(dia("2026-09-21")).toHaveAttribute("aria-disabled", "true");
    expect(dia("2026-09-21")).toHaveAccessibleName("lunes 21 de septiembre de 2026, cerrado");
    expect(dia("2026-09-21")).toHaveClass("line-through");
    expect(screen.getByText("Los días tachados están cerrados.")).toBeInTheDocument();
  });

  it("el día siguiente al último elegible es «no disponible» y el último sí se elige", () => {
    const hasta = sumarDias(HOY, 59);
    render(<Asistente hasta={hasta} dias={TODOS} />);
    fireEvent.click(mesSiguiente());
    fireEvent.click(mesSiguiente());

    expect(dia(hasta)).not.toHaveAttribute("aria-disabled");
    expect(dia(sumarDias(hasta, 1))).toHaveAttribute("aria-disabled", "true");
    expect(dia(sumarDias(hasta, 1)).getAttribute("aria-label")).toMatch(/, no disponible$/);
  });

  it("activar un día no elegible no cambia la fecha, pero sigue siendo enfocable", () => {
    const onChange = jest.fn();
    render(<Asistente onChange={onChange} />);

    fireEvent.click(dia("2026-09-13"));
    fireEvent.click(dia("2026-09-21"));

    expect(onChange).not.toHaveBeenCalled();
    dia("2026-09-21").focus();
    expect(dia("2026-09-21")).toHaveFocus();
  });

  it("elegir un día elegible lo deja como el único con aria-pressed", () => {
    render(<Asistente />);

    fireEvent.click(dia("2026-09-19"));
    fireEvent.click(dia("2026-09-20"));

    expect(dia("2026-09-20")).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);
  });
});

describe("Calendario - nombre accesible y hoy", () => {
  it("el día de hoy elegible se llama «…, hoy» y va en negrita y subrayado", () => {
    render(<Asistente hoy="2026-09-19" />);

    expect(dia("2026-09-19")).toHaveAccessibleName("sábado 19 de septiembre de 2026, hoy");
    expect(dia("2026-09-19")).toHaveClass("font-bold", "underline");
  });
});

describe("Calendario - límites de la navegación por meses", () => {
  it("«Mes anterior» está deshabilitado en el mes de hoy y «Mes siguiente» en el del último día", () => {
    render(<Asistente hasta="2026-10-20" />);

    expect(mesAnterior()).toBeDisabled();
    expect(mesSiguiente()).toBeEnabled();
    fireEvent.click(mesSiguiente());
    expect(mesSiguiente()).toBeDisabled();
    expect(mesAnterior()).toBeEnabled();
  });
});

describe("Calendario - teclado", () => {
  it("hay exactamente un día con tabindex=0 en el mes visible", () => {
    render(<Asistente />);

    expect(document.querySelectorAll('button[data-fecha][tabindex="0"]')).toHaveLength(1);
    fireEvent.click(mesSiguiente());
    expect(document.querySelectorAll('button[data-fecha][tabindex="0"]')).toHaveLength(1);
  });

  it.each([
    ["ArrowRight", "2026-09-17"],
    ["ArrowDown", "2026-09-23"],
    ["Home", "2026-09-14"],
    ["End", "2026-09-20"],
  ])("desde el miércoles 16, %s lleva el foco a %s", (tecla, destino) => {
    render(<Asistente />);
    dia("2026-09-16").focus();

    const siguio = fireEvent.keyDown(dia("2026-09-16"), { key: tecla });

    expect(enfocado()).toBe(destino);
    // Las teclas de movimiento no desplazan la página.
    expect(siguio).toBe(false);
  });

  it("AvPág desde el 31 de enero de 2027 muestra febrero y enfoca el 28", () => {
    render(<Asistente hoy="2027-01-15" />);
    fireEvent.click(dia("2027-01-31"));
    dia("2027-01-31").focus();

    fireEvent.keyDown(dia("2027-01-31"), { key: "PageDown" });

    expect(enfocado()).toBe("2027-02-28");
    expect(diasVisibles()).toHaveLength(28);
  });

  it("RePág vuelve al mes anterior conservando el día", () => {
    render(<Asistente />);
    fireEvent.click(mesSiguiente());
    dia("2026-10-20").focus();

    fireEvent.keyDown(dia("2026-10-20"), { key: "PageUp" });

    expect(enfocado()).toBe("2026-09-20");
  });

  it("con el foco en hoy, la flecha izquierda no lo mueve", () => {
    render(<Asistente />);
    dia(HOY).focus();

    fireEvent.keyDown(dia(HOY), { key: "ArrowLeft" });

    expect(enfocado()).toBe(HOY);
  });

  it("más allá del último día elegible la flecha derecha no mueve el foco", () => {
    render(<Asistente hasta="2026-09-30" />);
    dia("2026-09-30").focus();

    fireEvent.keyDown(dia("2026-09-30"), { key: "ArrowRight" });

    expect(enfocado()).toBe("2026-09-30");
  });
});

describe("objetivo táctil en pantallas angostas", () => {
  // jsdom no calcula el ancho: se fija por clases lo que midió el navegador a 390 px (tarea 4.1).
  // La celda ocupa 1/7 del ancho útil de la tarjeta; con `p-0.5` en la celda y `p-3` en la tarjeta
  // el botón medía 43,4 px (menos del mínimo de 44). Sin relleno horizontal en la celda y con
  // tarjeta más ajustada en móvil, el botón llega a 44 px desde 360 px de ancho.
  it("cada día mide al menos 44 px de alto y la celda no le quita ancho en móvil", () => {
    render(<Asistente />);
    const boton = dia("2026-09-15");
    expect(boton.className).toMatch(/\bh-11\b/);
    const celda = boton.closest("td");
    expect(celda?.className).toMatch(/\bpx-0\b/);
    expect(celda?.className).not.toMatch(/(^|\s)p-0\.5\b/);
  });

  it("la tarjeta usa un relleno menor en móvil y el normal desde sm", () => {
    const { container } = render(<Asistente />);
    const tarjeta = container.firstElementChild as HTMLElement;
    expect(tarjeta.className).toMatch(/\bp-2\b/);
    expect(tarjeta.className).toMatch(/\bsm:p-3\b/);
  });
});
