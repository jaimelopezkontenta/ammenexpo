import { DEFAULT_PLAN_LOCALE, type PlanLocale } from "../locale.ts";
import {
  type GenerateArgs,
  type GenerateResult,
  type PlanProvider,
} from "./types.ts";

/**
 * Deterministic days for local/CI. Not a quality fallback: scripture refs are
 * real RVR1909 rows so the resolver accepts them. Production stays Anthropic.
 */
const FIXTURE_PLAN_ES = {
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

/**
 * El mismo plan para un plan en inglés: los mismos pasajes, con el nombre de
 * libro de la WEB («John», «Psalms»), que es contra la que se verifican. Todos
 * existen en la WEB (`fixture.test.ts` comprueba los nombres de libro).
 */
const FIXTURE_PLAN_EN = {
  title: "Peace for this stretch",
  theme: "Peace",
  days: [
    {
      day_number: 1,
      title: "A peace the world does not give",
      scripture_ref: "John 14:27",
      interpretation:
        "Jesus does not promise that the noise will simply stop. He promises a peace that holds while the day is still the day. Today you do not have to solve everything; it is enough to receive what He gives.",
      daily_action:
        "Sit in silence for one minute and say quietly: “your peace, not mine.”",
      prayer_body:
        "Father, today I bring the knot I do not know how to untie. I want your peace, not the one the world sells. Stay with me in the details of this day. Amen.",
      intercessor_prayer:
        "Lord, I pray for this person. Give them your peace in what they are living through, and do not let them be alone with the knot. Amen.",
    },
    {
      day_number: 2,
      title: "Trusting with the heart",
      scripture_ref: "Proverbs 3:5",
      interpretation:
        "Trusting God is not the same as no longer thinking. It is not carrying the day as if everything depended on getting it right the first time.",
      daily_action: "Write down one thing you do not have to decide yet today.",
      prayer_body:
        "Lord, I trust you with what I do not understand. Loosen my need to control everything. Amen.",
      intercessor_prayer:
        "God, hold this person up so they do not lean only on their own understanding. Amen.",
    },
    {
      day_number: 3,
      title: "Come to me",
      scripture_ref: "Matthew 11:28",
      interpretation:
        "The invitation is for whoever is truly tired. You do not have to arrive rested to deserve rest.",
      daily_action: "Pause one task for five minutes and breathe slowly.",
      prayer_body:
        "Jesus, I come to you tired. Receive me as I am. Teach me to let go of the weight that is not mine to carry. Amen.",
      intercessor_prayer:
        "Lord, may this person find rest in you and not in more effort. Amen.",
    },
    {
      day_number: 4,
      title: "The Lord is my shepherd",
      scripture_ref: "Psalms 23:1",
      interpretation:
        "If the Lord is the shepherd, what is essential does not run out today, even if what we wanted does. There is a care that does not depend on how well we perform.",
      daily_action: "Say out loud one thing you do have today.",
      prayer_body:
        "Lord, you shepherd this day. In what I lack, remind me of what I do not lack: you. Amen.",
      intercessor_prayer:
        "Father, shepherd this person today. May they not feel unprotected. Amen.",
    },
    {
      day_number: 5,
      title: "God is our refuge",
      scripture_ref: "Psalms 46:1",
      interpretation:
        "A refuge does not mean nothing shakes. It means there is someone to run to when it does.",
      daily_action:
        "When the rush shows up, stop and say: “You are my refuge.”",
      prayer_body:
        "God, when I am pressed I want to come to you first, not to the noise. Be my refuge now. Amen.",
      intercessor_prayer:
        "Lord, be a refuge for this person in whatever is pressing on them today. Amen.",
    },
    {
      day_number: 6,
      title: "Do not be afraid",
      scripture_ref: "Isaiah 41:10",
      interpretation:
        "“Don’t be afraid” does not deny the fear. It names who holds you up when the fear comes.",
      daily_action:
        "Put a hand on your chest and ask for help in one short sentence.",
      prayer_body:
        "Lord, I am afraid, and even so I put myself in your hands. Hold me up. Amen.",
      intercessor_prayer:
        "God, hold this person up. May they not be left alone with the fear. Amen.",
    },
    {
      day_number: 7,
      title: "Peace once more",
      scripture_ref: "John 14:27",
      interpretation:
        "The plan ends where it began: not as the world gives. Today you can close this stretch without having solved everything.",
      daily_action: "Give thanks in one sentence for what did hold these days.",
      prayer_body:
        "Father, thank you for walking with me. I leave in your hands what is still open. Amen.",
      intercessor_prayer:
        "Lord, keep this person as they close this stretch, and open what comes next for them. Amen.",
    },
  ],
};

/** El plan de pruebas de cada idioma (exportado para sus tests). */
export const FIXTURE_PLANS: Record<PlanLocale, typeof FIXTURE_PLAN_ES> = {
  es: FIXTURE_PLAN_ES,
  en: FIXTURE_PLAN_EN,
};

export const createFixtureProvider = (): PlanProvider => ({
  name: "fixture",
  generate: ({ locale }: GenerateArgs): Promise<GenerateResult> =>
    Promise.resolve({
      json: JSON.stringify(FIXTURE_PLANS[locale ?? DEFAULT_PLAN_LOCALE]),
      model: "fixture",
    }),
});
