import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MesasPanel } from "../../../src/components/admin/mesas-panel";
import { TurnosPanel } from "../../../src/components/admin/turnos-panel";
import { ZonasPanel } from "../../../src/components/admin/zonas-panel";
import { adminClient } from "../../../src/lib/api/admin-client";

// Se reemplazan solo los métodos de `adminClient`: `toAdminApiResult` y el mapeo de errores
// son los reales.
jest.mock("../../../src/lib/api/admin-client", () => {
  const real = jest.requireActual("../../../src/lib/api/admin-client");
  return {
    ...real,
    adminClient: { GET: jest.fn(), POST: jest.fn(), PATCH: jest.fn(), DELETE: jest.fn() },
  };
});

const GET = adminClient.GET as unknown as jest.Mock;
const POST = adminClient.POST as unknown as jest.Mock;
const PATCH = adminClient.PATCH as unknown as jest.Mock;
const DELETE = adminClient.DELETE as unknown as jest.Mock;

function ok(data: unknown, status = 200) {
  return Promise.resolve({ data, response: { ok: true, status } });
}

function error(status: number, message: string | string[]) {
  return Promise.resolve({ error: { statusCode: status, message }, response: { ok: false, status } });
}

const ZONA_STD = {
  id: "z-std",
  nombre: "STANDARD" as const,
  minComensales: 1,
  maxComensales: 8,
  anticipacionMinHoras: 2,
  anticipacionMaxDias: 30,
  ventanaCancelacionHoras: 2,
  requiereConfirmacionAdmin: false,
  aforoMaximo: 40,
};
const ZONA_VIP = { ...ZONA_STD, id: "z-vip", nombre: "VIP" as const, aforoMaximo: 20 };

beforeEach(() => {
  for (const mock of [GET, POST, PATCH, DELETE]) mock.mockReset();
});

describe("ZonasPanel", () => {
  function editarStandard() {
    const onZonaActualizada = jest.fn();
    render(<ZonasPanel zonas={[ZONA_STD, ZONA_VIP]} onZonaActualizada={onZonaActualizada} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar zona STANDARD" }));
    return onZonaActualizada;
  }

  it("con un formulario abierto no se puede abrir el de otra Zona, y el foco va al primer campo", () => {
    editarStandard();

    expect(screen.getByRole("button", { name: "Editar zona VIP" })).toBeDisabled();
    expect(screen.getByLabelText("Mínimo de comensales")).toHaveFocus();
  });

  it("no ofrece alta ni baja de Zona", () => {
    render(<ZonasPanel zonas={[ZONA_STD]} onZonaActualizada={jest.fn()} />);

    expect(screen.queryByRole("button", { name: /agregar|eliminar|baja/i })).not.toBeInTheDocument();
  });

  it("edición exitosa envía el PATCH y reporta la Zona actualizada", async () => {
    const actualizada = { ...ZONA_STD, aforoMaximo: 45 };
    PATCH.mockReturnValue(ok(actualizada));
    const onZonaActualizada = editarStandard();

    fireEvent.change(screen.getByLabelText("Aforo máximo"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onZonaActualizada).toHaveBeenCalledWith(actualizada));
    // Solo viaja el campo modificado.
    expect(PATCH).toHaveBeenCalledWith("/admin/zonas/{id}", {
      params: { path: { id: "z-std" } },
      body: { aforoMaximo: 45 },
    });
  });

  it("un 400 por rango de comensales muestra el error en el campo y no actualiza", async () => {
    PATCH.mockReturnValue(error(400, "El mínimo de comensales no puede ser mayor que el máximo."));
    const onZonaActualizada = editarStandard();

    fireEvent.change(screen.getByLabelText("Mínimo de comensales"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("El mínimo de comensales no puede ser mayor que el máximo."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mínimo de comensales")).toHaveAttribute("aria-invalid", "true");
    expect(onZonaActualizada).not.toHaveBeenCalled();
  });

  it("sin cambios no envía nada y cierra el formulario", () => {
    editarStandard();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(PATCH).not.toHaveBeenCalled();
    expect(screen.queryByRole("form", { name: "Editar zona STANDARD" })).not.toBeInTheDocument();
  });

  it("un valor no entero se marca sin enviar nada", () => {
    editarStandard();

    fireEvent.change(screen.getByLabelText("Aforo máximo"), { target: { value: "3.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(PATCH).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Aforo máximo")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("MesasPanel", () => {
  const M1 = { id: "m-1", zonaId: "z-std", capacidad: 4, etiqueta: "M1" };

  async function renderizar(mesas = [M1]) {
    GET.mockReturnValue(ok(mesas));
    render(<MesasPanel zonas={[ZONA_STD, ZONA_VIP]} />);
    await waitFor(() => expect(screen.queryByText("Cargando mesas…")).not.toBeInTheDocument());
  }

  function completarAlta(etiqueta = "M9") {
    fireEvent.click(screen.getByRole("button", { name: "Agregar mesa" }));
    const formulario = screen.getByRole("form", { name: "Nueva mesa" });
    fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-vip" } });
    fireEvent.change(within(formulario).getByLabelText("Capacidad"), { target: { value: "6" } });
    fireEvent.change(within(formulario).getByLabelText("Etiqueta"), { target: { value: etiqueta } });
    fireEvent.click(within(formulario).getByRole("button", { name: "Agregar mesa" }));
  }

  it("filtrar por Zona pide el listado con zonaId", async () => {
    await renderizar();

    fireEvent.change(screen.getByLabelText("Filtrar por zona"), { target: { value: "z-vip" } });

    await waitFor(() =>
      expect(GET).toHaveBeenLastCalledWith("/admin/mesas", { params: { query: { zonaId: "z-vip" } } }),
    );
  });

  it("alta exitosa agrega la fila", async () => {
    await renderizar();
    POST.mockReturnValue(ok({ id: "m-9", zonaId: "z-vip", capacidad: 6, etiqueta: "M9" }, 201));

    completarAlta();

    expect(await screen.findByRole("rowheader", { name: "M9" })).toBeInTheDocument();
    expect(POST).toHaveBeenCalledWith("/admin/mesas", {
      body: { zonaId: "z-vip", capacidad: 6, etiqueta: "M9" },
    });
  });

  it("un 409 por etiqueta duplicada se muestra junto a la etiqueta", async () => {
    await renderizar();
    POST.mockReturnValue(error(409, "Ya existe una mesa con esa etiqueta."));

    completarAlta("M1");

    expect(await screen.findByText("Ya existe una mesa con esa etiqueta.")).toBeInTheDocument();
    const formulario = screen.getByRole("form", { name: "Nueva mesa" });
    expect(within(formulario).getByLabelText("Etiqueta")).toHaveAttribute("aria-invalid", "true");
  });

  it("un 404 por Zona inexistente se muestra junto a la Zona", async () => {
    await renderizar();
    POST.mockReturnValue(error(404, "La zona indicada no existe."));

    completarAlta();

    expect(await screen.findByText("La zona indicada no existe.")).toBeInTheDocument();
    const formulario = screen.getByRole("form", { name: "Nueva mesa" });
    expect(within(formulario).getByLabelText("Zona")).toHaveAttribute("aria-invalid", "true");
  });

  it("con un formulario abierto no se puede abrir otro", async () => {
    await renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Editar mesa M1" }));

    expect(screen.getByRole("button", { name: "Editar mesa M1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar mesa" })).toBeDisabled();
    // El foco pasa al primer campo del formulario, no se pierde en el documento.
    const formulario = screen.getByRole("form", { name: "Editar mesa M1" });
    expect(within(formulario).getByLabelText("Zona")).toHaveFocus();
  });

  it("confirmar la baja envía el DELETE y quita la fila", async () => {
    await renderizar();
    DELETE.mockReturnValue(Promise.resolve({ response: { ok: true, status: 204 } }));

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));

    await waitFor(() => expect(screen.queryByRole("rowheader", { name: "M1" })).not.toBeInTheDocument());
    expect(DELETE).toHaveBeenCalledWith("/admin/mesas/{id}", { params: { path: { id: "m-1" } } });
  });

  it("cancelar en el paso de confirmación no envía nada", async () => {
    await renderizar();

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(DELETE).not.toHaveBeenCalled();
    expect(screen.getByRole("rowheader", { name: "M1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dar de baja" })).toHaveFocus();
  });

  it("un 409 por Reservas asociadas muestra el motivo y la fila sigue", async () => {
    await renderizar();
    DELETE.mockReturnValue(error(409, "No se puede eliminar una mesa con reservas asociadas."));

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));

    expect(
      await screen.findByText("No se puede eliminar una mesa con reservas asociadas."),
    ).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "M1" })).toBeInTheDocument();
  });
});

describe("TurnosPanel", () => {
  const VIERNES = {
    id: "t-1",
    diaSemana: "VIERNES" as const,
    horaInicio: "1970-01-01T20:00:00.000Z",
    horaFin: "1970-01-01T23:30:00.000Z",
    activo: true,
  };

  async function renderizar() {
    GET.mockReturnValue(ok([VIERNES]));
    render(<TurnosPanel />);
    await screen.findByRole("rowheader", { name: "Viernes" });
  }

  function completarAlta() {
    fireEvent.click(screen.getByRole("button", { name: "Agregar turno" }));
    const formulario = screen.getByRole("form", { name: "Nuevo turno" });
    fireEvent.change(within(formulario).getByLabelText("Día"), { target: { value: "SABADO" } });
    fireEvent.change(within(formulario).getByLabelText("Hora de inicio"), { target: { value: "12:00" } });
    fireEvent.change(within(formulario).getByLabelText("Hora de fin"), { target: { value: "15:30" } });
    fireEvent.click(within(formulario).getByRole("button", { name: "Agregar turno" }));
  }

  it("muestra las horas en HH:mm, sin conversión de huso horario", async () => {
    await renderizar();

    expect(screen.getByText("20:00 a 23:30")).toBeInTheDocument();
  });

  it("alta exitosa agrega la fila con sus horas en HH:mm", async () => {
    await renderizar();
    POST.mockReturnValue(
      ok({ id: "t-2", diaSemana: "SABADO", horaInicio: "1970-01-01T12:00:00.000Z", horaFin: "1970-01-01T15:30:00.000Z", activo: true }, 201),
    );

    completarAlta();

    expect(await screen.findByText("12:00 a 15:30")).toBeInTheDocument();
    expect(POST).toHaveBeenCalledWith("/admin/turnos", {
      body: { diaSemana: "SABADO", horaInicio: "12:00", horaFin: "15:30", activo: true },
    });
  });

  it("un 409 por Turno duplicado se muestra junto al día y el horario", async () => {
    await renderizar();
    POST.mockReturnValue(error(409, "Ya existe un turno para ese día y esa hora de inicio."));

    completarAlta();

    const formulario = screen.getByRole("form", { name: "Nuevo turno" });
    await waitFor(() =>
      expect(within(formulario).getByLabelText("Día")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(within(formulario).getByLabelText("Hora de inicio")).toHaveAttribute("aria-invalid", "true");
  });

  it("con un formulario abierto no se puede abrir otro, y el foco va al primer campo", async () => {
    await renderizar();

    fireEvent.click(screen.getByRole("button", { name: /^Editar turno Viernes/ }));

    expect(screen.getByRole("button", { name: /^Editar turno Viernes/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar turno" })).toBeDisabled();
    const formulario = screen.getByRole("form", { name: /^Editar turno Viernes/ });
    expect(within(formulario).getByLabelText("Día")).toHaveFocus();
  });

  it("guardar cierra el formulario y deja habilitado abrir otro", async () => {
    await renderizar();
    PATCH.mockReturnValue(ok({ ...VIERNES, horaFin: "1970-01-01T23:45:00.000Z" }));

    fireEvent.click(screen.getByRole("button", { name: /^Editar turno Viernes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(screen.queryByRole("form", { name: /^Editar turno/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("20:00 a 23:45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar turno" })).toBeEnabled();
  });

  it("desactivar un Turno lo deja en el listado marcado como inactivo", async () => {
    await renderizar();
    PATCH.mockReturnValue(ok({ ...VIERNES, activo: false }));

    fireEvent.click(screen.getByRole("button", { name: /^Desactivar turno Viernes/ }));

    expect(await screen.findByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Viernes" })).toBeInTheDocument();
    expect(PATCH).toHaveBeenCalledWith("/admin/turnos/{id}", {
      params: { path: { id: "t-1" } },
      body: { activo: false },
    });
  });
});
