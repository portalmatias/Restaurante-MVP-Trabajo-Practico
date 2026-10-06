/**
 * Credenciales del admin del seed de desarrollo (`seed.ts`). No son secretas: están
 * documentadas en el README para que cualquiera del equipo pueda loguearse en su entorno
 * local (config.yaml §10).
 *
 * Viven en un módulo propio, sin efectos al importarlo, para que `seed-produccion.ts` las
 * importe en lugar de copiarlas (D8 de `despliegue-continuo-ec2`): el seed de producción se
 * niega a crear un admin con estas credenciales, y la comparación no puede quedar
 * desactualizada si alguien las cambia acá.
 */
export const ADMIN_EMAIL_DESARROLLO = 'admin@restaurante-mvp.local';
export const ADMIN_PASSWORD_DESARROLLO = 'AdminMVP2026!';
