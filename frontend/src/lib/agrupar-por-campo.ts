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
