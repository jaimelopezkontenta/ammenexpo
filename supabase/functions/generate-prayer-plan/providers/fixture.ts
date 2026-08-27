import { type GenerateResult, type PlanProvider } from "./types.ts";

/**
 * Deterministic days for local/CI. Not a quality fallback: scripture refs are
 * real RVR1909 rows so the resolver accepts them. Production stays Anthropic.
 */
const FIXTURE_PLAN = {
  title: "Paz para este tramo",
  theme: "Paz",
  days: [
    {
      day_number: 1,
      title: "La paz que no es del mundo",
      scripture_ref: "Juan 14:27",
      interpretation:
        "Jesús no promete que el ruido se apague solo. Promete una paz que se sostiene cuando el día sigue siendo el día. Hoy no hay que resolverlo todo; basta con recibir lo que Él da.",
      daily_action:
        "Siéntate un minuto en silencio y di en voz baja: «tu paz, no la mía».",
      prayer_body:
        "Padre, hoy traigo el nudo que no sé desatar. Quiero tu paz, no la que el mundo vende. Quédate conmigo en lo concreto de este día. Amén.",
      intercessor_prayer:
        "Señor, te pido por esta persona. Dale tu paz en lo que está viviendo, y que no se quede sola con el nudo. Amén.",
    },
    {
      day_number: 2,
      title: "Confiar el corazón",
      scripture_ref: "Proverbios 3:5",
      interpretation:
        "Fiarse de Dios no es dejar de pensar. Es no cargar el día como si todo dependiera de acertar a la primera.",
      daily_action: "Escribe una cosa que hoy no tienes que decidir todavía.",
      prayer_body:
        "Señor, me fío de Ti con lo que no entiendo. Suelta mi necesidad de controlarlo todo. Amén.",
      intercessor_prayer:
        "Dios, sostiene a esta persona para que no se apoye solo en su propia prudencia. Amén.",
    },
    {
      day_number: 3,
      title: "Venid a mí",
      scripture_ref: "Mateo 11:28",
      interpretation:
        "El convite es para quien está cansado de verdad. No hay que llegar descansado para merecer descanso.",
      daily_action: "Para cinco minutos una tarea y respira despacio.",
      prayer_body:
        "Jesús, vengo cansado. Recíbeme como estoy. Enséñame a soltar el peso que no me toca. Amén.",
      intercessor_prayer:
        "Señor, que esta persona encuentre descanso en Ti y no en más esfuerzo. Amén.",
    },
    {
      day_number: 4,
      title: "El Señor es mi pastor",
      scripture_ref: "Salmos 23:1",
      interpretation:
        "Si el Señor pastorea, hoy no falta lo esencial aunque falte lo que queríamos. Hay un cuidado que no depende de nuestro rendimiento.",
      daily_action: "Nombra en voz alta una cosa que sí tienes hoy.",
      prayer_body:
        "Señor, Tú pastoreas este día. En lo que me falta, recuérdame lo que no me falta: Tú. Amén.",
      intercessor_prayer:
        "Padre, pastorea a esta persona hoy. Que no se sienta desprotegida. Amén.",
    },
    {
      day_number: 5,
      title: "Dios es nuestro amparo",
      scripture_ref: "Salmos 46:1",
      interpretation:
        "Amparo no es que nada tiembla. Es que hay a quién ir cuando tiembla.",
      daily_action: "Cuando aparezca la prisa, para y di: «Tú eres mi amparo».",
      prayer_body:
        "Dios, en el apuro quiero ir a Ti primero, no al ruido. Sé mi amparo ahora. Amén.",
      intercessor_prayer:
        "Señor, sé amparo de esta persona en lo que hoy le aprieta. Amén.",
    },
    {
      day_number: 6,
      title: "No temas",
      scripture_ref: "Isaías 41:10",
      interpretation:
        "El «no temas» no niega el miedo. Nombra quién sostiene cuando el miedo llega.",
      daily_action: "Pon una mano en el pecho y pide ayuda en una frase corta.",
      prayer_body:
        "Señor, tengo miedo y aun así me pongo en tus manos. Sostenme. Amén.",
      intercessor_prayer:
        "Dios, sostiene a esta persona. Que no se quede sola con el miedo. Amén.",
    },
    {
      day_number: 7,
      title: "La paz otra vez",
      scripture_ref: "Juan 14:27",
      interpretation:
        "El plan acaba donde empezó: no como el mundo da. Hoy se puede cerrar el tramo sin haberlo resuelto todo.",
      daily_action: "Agradece en una frase lo que sí se sostuvo estos días.",
      prayer_body:
        "Padre, gracias por acompañarme. Dejo en Ti lo que sigue abierto. Amén.",
      intercessor_prayer:
        "Señor, guarda a esta persona al cerrar este tramo y ábrele lo que sigue. Amén.",
    },
  ],
};

export const createFixtureProvider = (): PlanProvider => ({
  name: "fixture",
  generate: (): Promise<GenerateResult> =>
    Promise.resolve({
      json: JSON.stringify(FIXTURE_PLAN),
      model: "fixture",
    }),
});
