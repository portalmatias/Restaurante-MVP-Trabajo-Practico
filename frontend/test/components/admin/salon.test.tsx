import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  planoColumnas: 12,
  planoFilas: 8,
};
const ZONA_VIP = {
  ...ZONA_STD,
  id: "z-vip",
  nombre: "VIP" as const,
  aforoMaximo: 20,
  planoColumnas: 10,
  planoFilas: 6,
};

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
  const M1 = {
    id: "m-1",
    zonaId: "z-std",
    capacidad: 4,
    etiqueta: "M1",
    posX: null,
    posY: null,
    ancho: 1,
    alto: 1,
    forma: "CUADRADA" as const,
  };

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
    fireEvent.click(within(formulario).getByRole("button", { name: "Guardar mesa" }));
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

  it("un error sobre la capacidad de la mesa se muestra junto a Capacidad", async () => {
    await renderizar();
    POST.mockReturnValue(error(400, "La capacidad de la mesa debe ser un entero positivo."));

    completarAlta();

    expect(await screen.findByText("La capacidad de la mesa debe ser un entero positivo.")).toBeInTheDocument();
    const formulario = screen.getByRole("form", { name: "Nueva mesa" });
    expect(within(formulario).getByLabelText("Capacidad")).toHaveAttribute("aria-invalid", "true");
  });

  it("un mensaje que solo menciona «capacidad» de otra cosa no se atribuye a Capacidad", async () => {
    await renderizar();
    POST.mockReturnValue(error(409, "El aforo de la zona no admite más capacidad en este turno."));

    completarAlta();

    expect(await screen.findByText("El aforo de la zona no admite más capacidad en este turno.")).toBeInTheDocument();
    const formulario = screen.getByRole("form", { name: "Nueva mesa" });
    expect(within(formulario).getByLabelText("Capacidad")).not.toHaveAttribute("aria-invalid", "true");
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

  // Change `plano-mesas-admin`, requisito "Ubicación de la Mesa en el plano"
  // (specs/frontend-admin/spec.md): un test por escenario. Layout del seed: STANDARD de 12 por 8
  // y VIP de 10 por 6. La pantalla numera columnas y filas desde 1; la API, desde 0.
  describe("ubicación en el plano", () => {
    type MesaFixture = {
      id: string;
      zonaId: string;
      capacidad: number;
      etiqueta: string;
      posX: number | null;
      posY: number | null;
      ancho: number;
      alto: number;
      forma: "REDONDA" | "CUADRADA" | "RECTANGULAR";
    };
    const mesaStd = (etiqueta: string, cambios: Partial<MesaFixture>): MesaFixture => ({
      id: `m-${etiqueta}`,
      zonaId: "z-std",
      capacidad: 4,
      etiqueta,
      posX: null,
      posY: null,
      ancho: 1,
      alto: 1,
      forma: "CUADRADA",
      ...cambios,
    });
    const S2 = mesaStd("S2", { capacidad: 2, posX: 2, posY: 0, forma: "REDONDA" });
    const S3 = mesaStd("S3", { posX: 5, posY: 0, ancho: 2, alto: 2 });
    const S4 = mesaStd("S4", { capacidad: 6, posX: 0, posY: 3, ancho: 3, alto: 2, forma: "RECTANGULAR" });
    const S5 = mesaStd("S5", { capacidad: 8, posX: 5, posY: 3, ancho: 4, alto: 2, forma: "RECTANGULAR" });
    const S7 = mesaStd("S7", {});
    const V4 = mesaStd("V4", { zonaId: "z-vip", capacidad: 12, posX: 4, posY: 3, ancho: 6, alto: 2, forma: "RECTANGULAR" });
    const V5 = mesaStd("V5", { zonaId: "z-vip", capacidad: 2, posX: 7, posY: 5 });
    const S4_FUERA = { ...S4, posX: 10 };

    type Respuesta = Promise<unknown>;
    /**
     * Responde `GET /admin/mesas` filtrando `mesas` por la zona pedida. `porZona` reemplaza la
     * respuesta de una zona (un error o una promesa que se resuelve a mano).
     */
    async function renderizarSalon(
      mesas: MesaFixture[] = [S2, S3, S4, S5, S7, V4, V5],
      porZona: Record<string, () => Respuesta> = {},
    ) {
      GET.mockImplementation((_ruta: string, opciones: { params: { query: { zonaId?: string } } }) => {
        const zonaId = opciones.params.query.zonaId;
        if (zonaId && porZona[zonaId]) return porZona[zonaId]();
        return ok(zonaId ? mesas.filter((m) => m.zonaId === zonaId) : mesas);
      });
      render(<MesasPanel zonas={[ZONA_STD, ZONA_VIP]} />);
      await waitFor(() => expect(screen.queryByText("Cargando mesas…")).not.toBeInTheDocument());
    }

    function editar(etiqueta: string) {
      fireEvent.click(screen.getByRole("button", { name: `Editar mesa ${etiqueta}` }));
      return screen.getByRole("form", { name: `Editar mesa ${etiqueta}` });
    }

    const seccion = (formulario: HTMLElement) =>
      within(formulario).getByRole("group", { name: "Ubicación en el plano" });
    const campo = (formulario: HTMLElement, nombre: string) =>
      within(seccion(formulario)).getByLabelText(nombre) as HTMLSelectElement;
    const elegir = (formulario: HTMLElement, nombre: string, valor: string) =>
      fireEvent.change(campo(formulario, nombre), { target: { value: valor } });
    const opciones = (formulario: HTMLElement, nombre: string) =>
      Array.from(campo(formulario, nombre).options)
        .map((opcion) => opcion.value)
        .filter((valor) => valor !== "");
    const textoUbicacion = (formulario: HTMLElement) =>
      within(formulario).getByTestId("ubicacion-texto");
    const dibujo = (formulario: HTMLElement) =>
      within(formulario).getByTestId("vista-previa") as unknown as SVGSVGElement;
    const guardar = (formulario: HTMLElement) =>
      fireEvent.click(within(formulario).getByRole("button", { name: "Guardar cambios" }));
    /** Espera a que la vista previa tenga las otras mesas de la zona (o el aviso de error). */
    const vistaPreviaCargada = (formulario: HTMLElement) =>
      waitFor(() => expect(within(formulario).queryByText("Cargando las mesas de la zona…")).not.toBeInTheDocument());

    function celdaPlano(etiqueta: string) {
      const fila = screen.getByRole("rowheader", { name: etiqueta }).closest("tr") as HTMLElement;
      return within(fila).getByTestId("celda-plano");
    }

    /** Responde el PATCH con la mesa original más el cuerpo enviado. */
    function patchQueDevuelve(mesa: MesaFixture) {
      PATCH.mockImplementation((_ruta: string, { body }: { body: Partial<MesaFixture> }) =>
        ok({ ...mesa, ...body }),
      );
    }

    const cuerpoEnviado = () => (PATCH.mock.calls[0][1] as { body: Record<string, unknown> }).body;

    // --- 4.3: campos de la sección -------------------------------------------------------------

    it("Columna limitada por el ancho: S5, de 4 de ancho, ofrece de 1 a 9", async () => {
      await renderizarSalon();
      const formulario = editar("S5");

      expect(opciones(formulario, "Columna")).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    });

    it("Ancho mayor corrige la columna: S2 en la columna 12 con ancho 2 pasa a la 11", async () => {
      await renderizarSalon();
      const formulario = editar("S2");

      elegir(formulario, "Columna", "12");
      elegir(formulario, "Ancho", "2");

      expect(campo(formulario, "Columna").value).toBe("11");
    });

    it("Mesa sin ubicar: campos vacíos, aviso y la vista previa no la dibuja", async () => {
      await renderizarSalon();
      const formulario = editar("S7");
      await vistaPreviaCargada(formulario);

      expect(campo(formulario, "Columna").value).toBe("");
      expect(campo(formulario, "Fila").value).toBe("");
      expect(textoUbicacion(formulario)).toHaveTextContent("La mesa no está en el plano.");
      expect(dibujo(formulario).querySelector('[data-mesa="S7"]')).toBeNull();
    });

    it("Mesa guardada fuera de la grilla: el listado la marca, los campos quedan vacíos y se reubica", async () => {
      await renderizarSalon([S2, S3, S4_FUERA, S5]);
      expect(celdaPlano("S4")).toHaveTextContent("Fuera de la grilla");
      const formulario = editar("S4");

      expect(campo(formulario, "Columna").value).toBe("");
      expect(campo(formulario, "Fila").value).toBe("");
      expect(textoUbicacion(formulario)).toHaveTextContent(
        "La mesa quedó fuera de la grilla de la zona: elegí una ubicación nueva.",
      );

      patchQueDevuelve(S4_FUERA);
      elegir(formulario, "Columna", "9");
      elegir(formulario, "Fila", "6");
      guardar(formulario);

      await waitFor(() => expect(celdaPlano("S4")).toHaveTextContent("Columna 9, fila 6"));
      expect(cuerpoEnviado()).toMatchObject({ posX: 8, posY: 5 });
    });

    it("Mesa guardada fuera de la grilla: guardar sin elegir envía posX y posY en null", async () => {
      await renderizarSalon([S4_FUERA]);
      patchQueDevuelve(S4_FUERA);
      const formulario = editar("S4");

      guardar(formulario);

      await waitFor(() => expect(PATCH).toHaveBeenCalled());
      expect(cuerpoEnviado()).toMatchObject({ posX: null, posY: null });
    });

    it("el alta no muestra la sección de ubicación", async () => {
      await renderizarSalon();

      fireEvent.click(screen.getByRole("button", { name: "Agregar mesa" }));

      const formulario = screen.getByRole("form", { name: "Nueva mesa" });
      expect(within(formulario).queryByRole("group", { name: "Ubicación en el plano" })).not.toBeInTheDocument();
    });

    // --- 4.4: vista previa y su texto ----------------------------------------------------------

    it("La vista previa sigue los valores elegidos sin contar la posición guardada de S3", async () => {
      await renderizarSalon();
      const formulario = editar("S3");
      await vistaPreviaCargada(formulario);

      elegir(formulario, "Ancho", "3");

      const editada = dibujo(formulario).querySelector('[data-editada] [data-forma]');
      expect(editada).toHaveAttribute("width", String(3 * 48 - 8));
      expect(textoUbicacion(formulario)).toHaveTextContent("S3 ocupa las columnas 6 a 8, filas 1 y 2.");
      expect(textoUbicacion(formulario)).not.toHaveTextContent("Se superpone");
    });

    it("Aviso de superposición en la vista previa, con el botón de guardar habilitado", async () => {
      await renderizarSalon();
      const formulario = editar("S4");
      await vistaPreviaCargada(formulario);

      elegir(formulario, "Columna", "5");
      elegir(formulario, "Fila", "4");

      expect(textoUbicacion(formulario)).toHaveTextContent("Se superpone con S5.");
      expect(within(formulario).getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    });

    it("Falla la carga de las mesas de la zona: dibuja la grilla y S4, avisa y deja guardar", async () => {
      await renderizarSalon(undefined, { "z-std": () => error(500, "Error interno") });
      const formulario = editar("S4");

      expect(
        await within(formulario).findByText(
          "No se pudieron cargar las otras mesas de la zona: no se puede avisar si se superpone.",
        ),
      ).toBeInTheDocument();
      expect(dibujo(formulario)).toHaveAttribute("viewBox", `0 0 ${12 * 48} ${8 * 48}`);
      expect(dibujo(formulario).querySelector('[data-editada][data-mesa="S4"]')).not.toBeNull();
      expect(within(formulario).getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    });

    it("Alternativa textual: el dibujo no se anuncia y el texto de la ubicación sí", async () => {
      await renderizarSalon();
      const formulario = editar("S4");
      await vistaPreviaCargada(formulario);

      expect(dibujo(formulario)).toHaveAttribute("aria-hidden", "true");
      expect(textoUbicacion(formulario)).toHaveAttribute("aria-live", "polite");
      expect(textoUbicacion(formulario)).toHaveTextContent("S4 ocupa las columnas 1 a 3, filas 4 y 5.");
    });

    // --- 4.5: armado del pedido ----------------------------------------------------------------

    it("Mover una mesa: S4 a la columna 9, fila 6 envía posX 8 y posY 5", async () => {
      await renderizarSalon();
      patchQueDevuelve(S4);
      const formulario = editar("S4");

      elegir(formulario, "Columna", "9");
      elegir(formulario, "Fila", "6");
      guardar(formulario);

      await waitFor(() => expect(celdaPlano("S4")).toHaveTextContent("Columna 9, fila 6"));
      expect(PATCH).toHaveBeenCalledWith("/admin/mesas/{id}", {
        params: { path: { id: "m-S4" } },
        body: { capacidad: 6, etiqueta: "S4", posX: 8, posY: 5 },
      });
    });

    it("Ubicar una mesa sin ubicar: S7 en la columna 12, fila 1 envía posX 11 y posY 0", async () => {
      await renderizarSalon();
      patchQueDevuelve(S7);
      const formulario = editar("S7");

      elegir(formulario, "Columna", "12");
      elegir(formulario, "Fila", "1");
      guardar(formulario);

      await waitFor(() => expect(celdaPlano("S7")).toHaveTextContent("Columna 12, fila 1"));
      expect(cuerpoEnviado()).toMatchObject({ posX: 11, posY: 0 });
    });

    it("Guardar sin ubicación no muestra error: S7 guarda solo la etiqueta y sigue sin ubicar", async () => {
      await renderizarSalon();
      patchQueDevuelve(S7);
      const formulario = editar("S7");

      fireEvent.change(within(formulario).getByLabelText("Etiqueta"), { target: { value: "S7b" } });
      guardar(formulario);

      await waitFor(() => expect(celdaPlano("S7b")).toHaveTextContent("Sin ubicar"));
      expect(cuerpoEnviado()).toEqual({ capacidad: 4, etiqueta: "S7b" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("Ubicación a medias no se envía: solo la columna muestra un error junto a la sección", async () => {
      await renderizarSalon();
      const formulario = editar("S7");

      elegir(formulario, "Columna", "3");
      guardar(formulario);

      expect(within(seccion(formulario)).getByRole("alert")).toHaveTextContent(
        "Elegí la columna y la fila, o dejá las dos vacías.",
      );
      expect(PATCH).not.toHaveBeenCalled();
    });

    it("Quitar del plano: S2 envía posX y posY en null y queda sin ubicar", async () => {
      await renderizarSalon();
      patchQueDevuelve(S2);
      const formulario = editar("S2");

      fireEvent.click(within(formulario).getByRole("button", { name: "Quitar del plano" }));
      guardar(formulario);

      await waitFor(() => expect(celdaPlano("S2")).toHaveTextContent("Sin ubicar"));
      expect(cuerpoEnviado()).toMatchObject({ posX: null, posY: null });
    });

    it("Pedido con las coordenadas juntas: cambiar solo la columna envía las dos y no el tamaño", async () => {
      await renderizarSalon();
      patchQueDevuelve(S4);
      const formulario = editar("S4");

      elegir(formulario, "Columna", "2");
      guardar(formulario);

      await waitFor(() => expect(PATCH).toHaveBeenCalled());
      expect(cuerpoEnviado()).toEqual({ capacidad: 6, etiqueta: "S4", posX: 1, posY: 3 });
    });

    it("cambiar la forma la envía sola, sin las coordenadas", async () => {
      await renderizarSalon();
      patchQueDevuelve(S3);
      const formulario = editar("S3");

      fireEvent.click(within(formulario).getByRole("radio", { name: "Redonda" }));
      guardar(formulario);

      await waitFor(() => expect(PATCH).toHaveBeenCalled());
      expect(cuerpoEnviado()).toEqual({ capacidad: 4, etiqueta: "S3", forma: "REDONDA" });
    });

    // --- 4.6: errores y listado ----------------------------------------------------------------

    it.each([
      [409, "La mesa se superpone con S3."],
      [400, "La mesa no entra en la grilla de 12 por 8."],
      [400, "La mesa queda fuera de la grilla de 12 por 8."],
    ])("un %i «%s» se muestra junto a la sección y el formulario sigue abierto", async (estado, mensaje) => {
      await renderizarSalon();
      PATCH.mockReturnValue(error(estado, mensaje));
      const formulario = editar("S4");

      elegir(formulario, "Columna", "6");
      guardar(formulario);

      await waitFor(() => expect(within(seccion(formulario)).getByRole("alert")).toHaveTextContent(mensaje));
      expect(screen.getByRole("form", { name: "Editar mesa S4" })).toBeInTheDocument();
    });

    it("un mensaje del ValidationPipe sobre posX se muestra con el texto propio de la sección", async () => {
      await renderizarSalon();
      PATCH.mockReturnValue(error(400, ["posX y posY van juntos: los dos con valor o los dos en null."]));
      const formulario = editar("S4");

      elegir(formulario, "Columna", "6");
      guardar(formulario);

      await waitFor(() =>
        expect(within(seccion(formulario)).getByRole("alert")).toHaveTextContent("Revisá la ubicación en el plano."),
      );
    });

    it("el listado muestra la columna Plano de cada mesa", async () => {
      await renderizarSalon([S2, S4_FUERA, S7]);

      expect(screen.getByRole("columnheader", { name: "Plano" })).toBeInTheDocument();
      expect(celdaPlano("S2")).toHaveTextContent("Columna 3, fila 1");
      expect(celdaPlano("S4")).toHaveTextContent("Fuera de la grilla");
      expect(celdaPlano("S7")).toHaveTextContent("Sin ubicar");
    });

    // --- 4.7: cambio de zona -------------------------------------------------------------------

    it("Cambio de zona en el formulario: la vista previa pasa a la zona nueva y vacía Columna y Fila", async () => {
      await renderizarSalon();
      const formulario = editar("S4");
      await vistaPreviaCargada(formulario);

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-vip" } });

      await waitFor(() => expect(dibujo(formulario).querySelector('[data-mesa="V4"]')).not.toBeNull());
      expect(dibujo(formulario)).toHaveAttribute("viewBox", `0 0 ${10 * 48} ${6 * 48}`);
      expect(dibujo(formulario).querySelector('[data-mesa="S5"]')).toBeNull();
      expect(campo(formulario, "Columna").value).toBe("");
      expect(campo(formulario, "Fila").value).toBe("");
    });

    it("Cambio a una zona más chica ajusta el tamaño: 12 por 8 en VIP pasa a 10 por 6", async () => {
      const grande = mesaStd("S9", { posX: 0, posY: 0, ancho: 12, alto: 8 });
      await renderizarSalon([grande]);
      const formulario = editar("S9");

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-vip" } });

      expect(campo(formulario, "Ancho").value).toBe("10");
      expect(campo(formulario, "Alto").value).toBe("6");
      expect(opciones(formulario, "Columna")).toEqual(["1"]);
      expect(opciones(formulario, "Fila")).toEqual(["1"]);
    });

    it("Cambio de zona sin elegir ubicación: V5 a STANDARD envía la zona con posX y posY en null", async () => {
      await renderizarSalon();
      patchQueDevuelve(V5);
      const formulario = editar("V5");

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-std" } });
      guardar(formulario);

      await waitFor(() => expect(celdaPlano("V5")).toHaveTextContent("Sin ubicar"));
      expect(cuerpoEnviado()).toEqual({ zonaId: "z-std", capacidad: 2, etiqueta: "V5", posX: null, posY: null });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("Cambio de zona con la misma columna y fila: envía la zona nueva con posX 7 y posY 5", async () => {
      await renderizarSalon();
      patchQueDevuelve(V5);
      const formulario = editar("V5");

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-std" } });
      elegir(formulario, "Columna", "8");
      elegir(formulario, "Fila", "6");
      guardar(formulario);

      await waitFor(() => expect(PATCH).toHaveBeenCalled());
      expect(cuerpoEnviado()).toMatchObject({ zonaId: "z-std", posX: 7, posY: 5 });
    });

    it("Volver a la zona original restaura la ubicación y el pedido no la envía", async () => {
      await renderizarSalon();
      patchQueDevuelve(S4);
      const formulario = editar("S4");

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-vip" } });
      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-std" } });

      expect(campo(formulario, "Columna").value).toBe("1");
      expect(campo(formulario, "Fila").value).toBe("4");
      expect(campo(formulario, "Ancho").value).toBe("3");
      expect(campo(formulario, "Alto").value).toBe("2");

      guardar(formulario);
      await waitFor(() => expect(PATCH).toHaveBeenCalled());
      expect(cuerpoEnviado()).toEqual({ capacidad: 6, etiqueta: "S4" });
    });

    it("Volver a la zona original con una mesa fuera de la grilla la deja como al abrir", async () => {
      await renderizarSalon([S4_FUERA]);
      const formulario = editar("S4");

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-vip" } });
      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-std" } });

      expect(campo(formulario, "Columna").value).toBe("");
      expect(campo(formulario, "Fila").value).toBe("");
      expect(textoUbicacion(formulario)).toHaveTextContent(
        "La mesa quedó fuera de la grilla de la zona: elegí una ubicación nueva.",
      );
    });

    // --- 4.8: respuestas fuera de orden --------------------------------------------------------

    it("Cambios de zona rápidos: la respuesta vieja de VIP que llega última no se dibuja", async () => {
      let resolverVip: (valor: unknown) => void = () => {};
      const vipDemorada = new Promise((resolver) => {
        resolverVip = resolver;
      });
      await renderizarSalon(undefined, { "z-vip": () => vipDemorada });
      const formulario = editar("S4");
      await vistaPreviaCargada(formulario);

      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-vip" } });
      fireEvent.change(within(formulario).getByLabelText("Zona"), { target: { value: "z-std" } });
      await waitFor(() => expect(dibujo(formulario).querySelector('[data-mesa="S5"]')).not.toBeNull());

      // La respuesta vieja llega al final; se espera a que React termine de procesarla.
      await act(async () => {
        resolverVip({ data: [V4, V5], response: { ok: true, status: 200 } });
        await vipDemorada;
      });

      expect(dibujo(formulario).querySelector('[data-mesa="V4"]')).toBeNull();
      expect(dibujo(formulario).querySelector('[data-mesa="S5"]')).not.toBeNull();
    });
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
    fireEvent.click(within(formulario).getByRole("button", { name: "Guardar turno" }));
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
