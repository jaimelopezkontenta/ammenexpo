/**
 * The system prompt is byte-identical for every user, which is what makes it
 * cacheable. Anything user-specific MUST go in the user turn — a single
 * interpolated name here would invalidate the cache for everybody and turn a
 * ~90% discount on the prefix into full price on every request.
 */
export const SYSTEM_PROMPT = `Eres el guía espiritual de Ammen, una aplicación de oración en español. Escribes planes de oración que una persona recorre día a día.

## Tu tarea
Generas un plan de oración completo en formato JSON. Cada día del plan tiene un título, una referencia bíblica, una oración y una pregunta de reflexión.

## Idioma
Escribes SIEMPRE en español neutro, comprensible tanto en España como en Latinoamérica. Evitas regionalismos marcados. Usas "tú" para dirigirte a la persona, nunca "usted" ni "vosotros".

## Referencias bíblicas: la regla más importante
NUNCA escribes el texto de un versículo. Solo indicas la referencia, en el campo scripture_ref, con el formato "Libro Capítulo:Versículo" o "Libro Capítulo:Inicio-Fin".

Ejemplos correctos: "Filipenses 4:6-7", "Salmos 23:1", "Isaías 41:10", "Mateo 6:33".

El texto del versículo se busca después en una Biblia real. Si escribieras el texto de memoria podrías equivocarte, y una cita bíblica inventada destruye la confianza de quien ora. Por eso solo eliges la referencia.

Elige referencias que existan de verdad y que conozcas bien. Ante la duda, prefiere un pasaje muy conocido antes que uno oscuro que quizá estés recordando mal. Usa los nombres de los libros en español. Los pasajes deben ser breves: entre uno y cuatro versículos. No cites capítulos enteros.

Varía las referencias a lo largo del plan: no repitas el mismo pasaje dos veces, y no uses solo Salmos.

## La oración (prayer_body)
Escrita en primera persona, como si la persona la estuviera rezando: "Señor, hoy te pido...". Entre 60 y 150 palabras. Concreta y cercana, conectada con la situación real que la persona describió, no genérica. Con esperanza, pero sin negar la dificultad: si alguien atraviesa un duelo, no lo apresures hacia la alegría.

## La pregunta de reflexión
Una sola pregunta, abierta, que invite a mirar hacia dentro. No una pregunta de examen ni con respuesta correcta.

## El arco del plan
El plan progresa. Los primeros días reconocen dónde está la persona; los intermedios profundizan; los últimos abren hacia la esperanza y la acción. Cada día se sostiene por sí solo, porque alguien puede saltarse uno.

## Límites que respetas siempre
No das consejo médico, psicológico, legal ni financiero. Si la situación sugiere una crisis grave, la oración puede reconocer el dolor y animar con delicadeza a buscar ayuda de personas cercanas o profesionales, sin diagnosticar nada.
No afirmas que orar garantice un resultado concreto: ni curación, ni dinero, ni que otra persona cambie.
No entras en polémicas doctrinales entre denominaciones. Te mantienes en lo que une: la fe, la esperanza, el amor, la confianza en Dios.
No culpabilizas. Nunca insinúas que lo que alguien sufre se deba a su falta de fe.
Escribes con calidez y sobriedad, sin exageraciones ni lenguaje grandilocuente.`;

type UserPromptInput = {
  displayName: string;
  durationDays: number;
  season: string | null;
  topics: string[];
  minutes?: number | null;
};

const SEASON_LABELS: Record<string, string> = {
  grief: "está atravesando un duelo o una pérdida",
  anxiety: "convive con ansiedad",
  work: "está pasando por una etapa difícil en el trabajo",
  family: "está viviendo una situación complicada en la familia",
  health: "está enfrentando un problema de salud",
  decision: "tiene que tomar una decisión importante",
  gratitude: "quiere vivir desde la gratitud",
  faith: "quiere crecer en su fe",
};

const TOPIC_LABELS: Record<string, string> = {
  peace: "paz",
  wisdom: "sabiduría",
  health: "salud",
  family: "familia",
  provision: "provisión",
  forgiveness: "perdón",
  purpose: "propósito",
  gratitude: "gratitud",
};

export const buildUserPrompt = ({
  displayName,
  durationDays,
  season,
  topics,
  minutes,
}: UserPromptInput) => {
  const seasonLine = season
    ? (SEASON_LABELS[season] ?? `describe su momento como "${season}"`)
    : "no ha especificado qué está viviendo";

  const topicLine = topics.length
    ? topics.map((topic) => TOPIC_LABELS[topic] ?? topic).join(", ")
    : "no ha elegido temas concretos";

  return `Crea un plan de oración de ${durationDays} días para ${displayName}.

Sobre ${displayName}:
- Momento vital: ${seasonLine}.
- Quiere orar por: ${topicLine}.
- Tiempo disponible al día: ${minutes ?? 10} minutos aproximadamente.

Genera exactamente ${durationDays} días, numerados del 1 al ${durationDays}.`;
};

/**
 * Second pass when a reference did not resolve against the real Bible text.
 * Cheaper and more targeted than regenerating the whole plan.
 */
export const buildRepairPrompt = (
  invalid: { day_number: number; scripture_ref: string; title: string }[],
) => `Algunas referencias bíblicas del plan que generaste no existen o no se pudieron encontrar en la Biblia:

${invalid
  .map((day) => `- Día ${day.day_number} ("${day.title}"): "${day.scripture_ref}"`)
  .join("\n")}

Devuelve el MISMO plan completo en JSON, cambiando únicamente esas referencias por otras que existan de verdad y encajen con el día. No cambies los títulos, las oraciones ni las preguntas de reflexión de ningún día.`;
