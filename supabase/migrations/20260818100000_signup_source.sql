-- Ammen — de dónde entró cada persona.
--
-- Ningún enlace decía por dónde había llegado alguien, así que el día que haya
-- analítica la pregunta «¿de dónde sale la gente?» no tendría respuesta hasta
-- tres meses después de empezar a recogerla.
--
-- **Y esto hay que ponerlo antes de que los enlaces circulen**: un enlace que
-- ya está en un grupo de WhatsApp no se puede reetiquetar. Es de las pocas
-- cosas de este proyecto donde llegar tarde no se arregla trabajando más.
--
-- Texto suelto y no un enum: el día que se invente un canal nuevo, añadirlo no
-- puede pedir una migración. Lo que llega se acota en el cliente, que es quien
-- construye el enlace.

alter table public.profile_settings
  add column signup_source text;

comment on column public.profile_settings.signup_source is
  'Por dónde entró: plan, imagen, invitacion, circulo. Se escribe una sola vez, al registrarse, y no se vuelve a tocar — reescribirlo con la última visita convertiría el dato de adquisición en un dato de uso.';
