/**
 * De un fallo de envío, el código que SÍ se puede registrar.
 *
 * `sendOne()` guarda en la base (`mark_email_delivery.p_error`) un texto que,
 * para un 4xx raro de Resend, incluye los primeros 80 caracteres de SU
 * respuesta — y esa respuesta puede citar el destinatario. En la base eso es
 * un dato más de la fila; en un log compartido, no. Aquí se reduce a un código
 * cerrado: `resend_429`, `resend_503`, `resend_missing_id` o `transport_error`.
 */
export const deliveryErrorCode = (error: string): string => {
  const match = /^(resend_missing_id|resend_\d{3})(?::|$)/.exec(error);
  return match ? match[1] : "transport_error";
};
