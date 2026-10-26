/**
 * Reloj inyectable del plano de mesas (change `plano-mesas`, design.md D2 y D8). En producción
 * es `new Date()`; los tests lo reemplazan con `overrideProvider(RELOJ)` para no depender de la
 * hora en que corren.
 */
export const RELOJ = 'RELOJ_PLANO_MESAS';

export type Reloj = () => Date;

export const relojDelSistema: Reloj = () => new Date();
