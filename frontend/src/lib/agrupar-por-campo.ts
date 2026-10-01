export type MensajesAgrupados = {
  porCampo: Record<string, string[]>;
  generales: string[];
};

/**
 * Reparte los mensajes de un `400` (`class-validator`, con el nombre del campo del DTO al
 * frente, ej. "emailCliente debe ser un email válido") entre los campos del formulario
 * (design.md D8). `campos` mapea el nombre del campo del DTO a la clave del formulario. Un
 * mensaje cuya primera palabra no es ninguno de esos nombres va a `generales`: nunca se pierde.
 */
export function agruparPorCampo(
  mensajes: string[],
  campos: Record<string, string>,
): MensajesAgrupados {
  const porCampo: Record<string, string[]> = {};
  const generales: string[] = [];
  const nombresDto = Object.keys(campos);

  for (const mensaje of mensajes) {
    // El nombre del campo debe ser la primera palabra del mensaje: `email` no debe robarle
    // los mensajes a `emailCliente`, ni un campo que solo comparte prefijo.
    const primeraPalabra = mensaje.split(" ", 1)[0];
    const nombreDto = nombresDto.find((nombre) => nombre === primeraPalabra);
    if (nombreDto === undefined) {
      generales.push(mensaje);
      continue;
    }
    const clave = campos[nombreDto];
    porCampo[clave] = [...(porCampo[clave] ?? []), mensaje];
  }

  return { porCampo, generales };
}

/**
 * Quita el nombre del campo del DTO con el que empieza un mensaje de `class-validator` y deja la
 * primera letra en mayúscula, para mostrarlo junto a su campo ("emailCliente debe ser un email
 * válido" -> "Debe ser un email válido"). Solo se llama con mensajes que `agruparPorCampo` ya
 * asignó a un campo, es decir, cuya primera palabra es ese nombre.
 */
export function sinNombreDeCampo(mensaje: string): string {
  // Sin espacio no hay nada después del nombre del campo: se devuelve tal cual.
  const primerEspacio = mensaje.indexOf(" ");
  const resto = primerEspacio === -1 ? "" : mensaje.slice(primerEspacio + 1).trimStart();
  return resto === "" ? mensaje : resto.charAt(0).toUpperCase() + resto.slice(1);
}
