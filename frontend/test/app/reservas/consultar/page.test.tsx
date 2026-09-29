import { render, screen } from "@testing-library/react";
import ConsultarPage from "../../../../app/reservas/consultar/page";

async function renderizar(searchParams: Record<string, string | string[] | undefined>) {
  render(await ConsultarPage({ searchParams: Promise.resolve(searchParams) }));
}

// design.md D1.2: la URL solo puede reflejar `?codigo=`; el email nunca se lee ni se refleja.
describe("/reservas/consultar", () => {
  it("sin parámetros muestra el formulario con el código vacío", async () => {
    await renderizar({});

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("prellena el código de ?codigo= en mayúsculas", async () => {
    await renderizar({ codigo: "k7pm3qxa" });

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("K7PM3QXA");
  });

  it("ignora un ?codigo= con formato inválido", async () => {
    await renderizar({ codigo: "<script>" });

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("");
  });

  it("ignora un ?codigo= repetido (lista)", async () => {
    await renderizar({ codigo: ["K7PM3QXA", "ZZZZZZZZ"] });

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("");
  });

  it("nunca prellena el email aunque venga en la URL", async () => {
    await renderizar({ codigo: "K7PM3QXA", email: "ana.perez@example.com" });

    expect(screen.getByLabelText("Email")).toHaveValue("");
  });

  it("no ofrece ningún enlace a la administración", async () => {
    await renderizar({});

    expect(document.querySelector('a[href^="/admin"]')).toBeNull();
  });

  it("al navegar de ?codigo=A a ?codigo=B el formulario se reinicia con el código nuevo", async () => {
    const { rerender } = render(
      await ConsultarPage({ searchParams: Promise.resolve({ codigo: "AAAAAAAA" }) }),
    );
    expect(screen.getByLabelText("Código de reserva")).toHaveValue("AAAAAAAA");

    rerender(await ConsultarPage({ searchParams: Promise.resolve({ codigo: "BBBBBBBB" }) }));

    expect(screen.getByLabelText("Código de reserva")).toHaveValue("BBBBBBBB");
  });
});
