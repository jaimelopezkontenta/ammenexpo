/**
 * Los términos y la política de privacidad.
 *
 * **Van aquí y no en `translation/*.json`** a propósito: son dos documentos de
 * varios cientos de palabras cada uno, y meterlos en el fichero de cadenas —que
 * se lee entero cada vez que alguien busca una etiqueta de botón— lo volvería
 * inmanejable. El compromiso de las dos traducciones idénticas se mantiene
 * igual: cada documento existe en `es` y en `en`, y hay un test que lo comprueba.
 *
 * **Esto es un borrador serio, no un texto legal revisado.** Dice lo que la app
 * hace de verdad —lo he escrito mirando el esquema, no una plantilla— y cubre lo
 * que la Guideline 1.2 de Apple exige: prohibición explícita del contenido
 * objetable, tolerancia cero, y las herramientas para reportar y bloquear. Antes
 * de publicar en una tienda tiene que pasarlo un abogado, sobre todo la parte de
 * datos si se distribuye en la Unión Europea.
 */

export const TERMS_VERSION = "2026-08-02";

type Document = { title: string; updated: string; body: string[] };

const ES_TERMS: Document = {
  title: "Términos de uso",
  updated: "Última actualización: 2 de agosto de 2026",
  body: [
    "Ammen es una app para orar cada día y para no hacerlo sola. Al crear una cuenta aceptas estos términos.",

    "**Quién puede usarla.** Tienes que tener al menos 13 años. Si vives en un país donde la edad mínima para dar tu consentimiento sobre datos es mayor, esa es la que aplica.",

    "**Tu cuenta es tuya.** No la compartas. Lo que se publique desde ella es responsabilidad de quien la usa.",

    "**Lo que escribes.** Tus peticiones de oración, testimonios, mensajes y comentarios son tuyos. Nos das permiso para guardarlos y mostrarlos a las personas que tú elijas: a nadie si el plan es privado, a tus círculos, a quien tenga el enlace, o a todo el mundo si lo publicas. Puedes borrarlos y cambiar de opinión cuando quieras.",

    "**Contenido prohibido, sin excepciones.** No se permite contenido que acose, amenace, insulte o humille a nadie; contenido sexual explícito; violencia gráfica; incitación al odio por raza, origen, religión, sexo, orientación sexual, discapacidad o identidad de género; contenido que promueva autolesiones; suplantar a otra persona; publicar datos privados de terceros; ni spam, estafas o publicidad. **Toleramos esto cero.** Una cuenta que lo publique se cierra, sin aviso previo y sin devolución si tenía suscripción.",

    "**Qué puedes hacer si te encuentras algo así.** Cada petición, comentario, mensaje y testimonio lleva un botón de reportar, y cada persona uno de bloquear. Bloquear es inmediato: deja de llegarte lo suyo en toda la app. Revisamos los reportes y actuamos en 24 horas, retirando el contenido y expulsando a quien lo publicó cuando corresponde.",

    "**La inteligencia artificial.** El plan de oración lo escribe un modelo de lenguaje a partir de lo que le cuentas. Lo que produce son **sugerencias para orar**: no es consejo médico, ni legal, ni psicológico, ni una enseñanza doctrinal de ninguna iglesia. Puede equivocarse. Si estás en una situación de riesgo, busca ayuda profesional.",

    "**La Biblia.** El texto bíblico es la Reina-Valera 1909, que es de dominio público.",

    "**Suscripción.** Hay funciones gratuitas y una suscripción de pago. Cuando exista, se cobra por la tienda de aplicaciones correspondiente y se cancela desde ahí; se renueva sola salvo que la canceles al menos 24 horas antes de que termine el periodo.",

    "**Podemos cambiar la app.** Añadimos y quitamos funciones. Si cambiamos estos términos de forma importante, te lo decimos dentro de la app y te pedimos que los aceptes otra vez.",

    "**Sin garantías.** La app se ofrece tal cual. Hacemos lo posible por que funcione y por cuidar lo que escribes, pero no podemos garantizar que no vaya a fallar nunca.",

    "**Cerrar tu cuenta.** Puedes borrarla desde tu perfil, y se borra de verdad, con todo lo que hay dentro. También puedes exportar tus datos antes.",

    "**Escríbenos.** hola@ammen.app",
  ],
};

const ES_PRIVACY: Document = {
  title: "Política de privacidad",
  updated: "Última actualización: 2 de agosto de 2026",
  body: [
    "Esto explica qué guardamos, por qué, y qué puedes hacer al respecto. Está escrito mirando la base de datos, no una plantilla.",

    "**Qué guardamos.** Tu correo y tu contraseña (cifrada, no la vemos). Tu nombre, tu foto si subes una, tu zona horaria, tu idioma y las horas a las que quieres orar. Lo que respondes en el onboarding: qué estás viviendo y por qué te gustaría orar. Tus planes de oración y los días que has marcado. Tus peticiones, testimonios, comentarios y mensajes. Con quién compartes cada cosa, a quién sigues y a quién has bloqueado.",

    "**Qué NO guardamos.** No pedimos tu ubicación, ni tu agenda de contactos, ni el micrófono, ni la cámara salvo cuando eliges una foto de perfil. No hay publicidad y no vendemos datos a nadie.",

    "**Quién ve lo tuyo.** Lo decide la base de datos, no una pantalla: cada plan, testimonio o petición lleva su nivel de visibilidad y las reglas se aplican en el servidor. Un plan privado no lo ve nadie más. La oración que escribes en primera persona no viaja nunca a quien ora por ti, ni siquiera con el plan compartido. Una petición anónima no lleva tu nombre **ni tu identificador**, así que dos peticiones anónimas tuyas no se pueden relacionar entre sí.",

    "**La inteligencia artificial.** Para escribir tu plan mandamos a Anthropic (el modelo Claude) lo que respondiste en el onboarding y el tema del plan. No mandamos tu nombre, ni tu correo, ni tus peticiones de oración. Anthropic no usa esos datos para entrenar sus modelos.",

    "**Dónde vive.** En Supabase, sobre infraestructura de Amazon Web Services. Los avatares están en un almacenamiento público: cualquiera con la URL exacta puede verlos, así que no subas ahí nada que no quieras que se vea.",

    "**Cuánto tiempo.** Mientras tengas cuenta. Cuando la borras, se borra todo lo tuyo. Los enlaces públicos que hayas creado caducan solos.",

    "**Tus derechos.** Puedes ver, corregir y borrar tus datos desde la propia app, y exportarlos en un fichero. Si estás en la Unión Europea, también puedes oponerte al tratamiento y presentar una reclamación ante tu autoridad de protección de datos.",

    "**Menores.** La app no está dirigida a menores de 13 años y no recogemos sus datos a sabiendas.",

    "**Escríbenos.** hola@ammen.app",
  ],
};

const EN_TERMS: Document = {
  title: "Terms of use",
  updated: "Last updated: 2 August 2026",
  body: [
    "Ammen is an app for praying every day, and for not doing it alone. Creating an account means you accept these terms.",

    "**Who can use it.** You must be at least 13. If you live somewhere the minimum age to consent to data processing is higher, that age applies.",

    "**Your account is yours.** Do not share it. Whatever is posted from it is the responsibility of whoever uses it.",

    "**What you write.** Your prayer requests, testimonies, messages and comments are yours. You give us permission to store them and show them to the people you choose: nobody if the plan is private, your circles, whoever holds the link, or everyone if you publish it. You can delete them and change your mind at any time.",

    "**Prohibited content, no exceptions.** No content that harasses, threatens, insults or humiliates anyone; no explicit sexual content; no graphic violence; no incitement to hatred on the basis of race, origin, religion, sex, sexual orientation, disability or gender identity; nothing promoting self-harm; no impersonation; no posting other people's private information; no spam, scams or advertising. **We have zero tolerance for this.** An account that posts it is closed, without prior warning and with no refund if it held a subscription.",

    "**What you can do if you run into it.** Every request, comment, message and testimony carries a report button, and every person a block button. Blocking is immediate: their things stop reaching you anywhere in the app. We review reports and act within 24 hours, removing content and removing whoever posted it where appropriate.",

    "**Artificial intelligence.** Your prayer plan is written by a language model from what you tell it. What it produces are **suggestions for prayer**: not medical, legal or psychological advice, and not the doctrinal teaching of any church. It can be wrong. If you are at risk, seek professional help.",

    "**The Bible.** The biblical text is the Reina-Valera 1909, which is in the public domain.",

    "**Subscription.** Some features are free and there is a paid subscription. Where it exists, it is billed by the corresponding app store and cancelled there; it renews automatically unless you cancel at least 24 hours before the period ends.",

    "**We may change the app.** We add and remove features. If we change these terms in an important way, we will tell you inside the app and ask you to accept them again.",

    "**No warranties.** The app is offered as is. We do our best to keep it working and to look after what you write, but we cannot guarantee it will never fail.",

    "**Closing your account.** You can delete it from your profile, and it is really deleted, along with everything inside. You can also export your data first.",

    "**Write to us.** hola@ammen.app",
  ],
};

const EN_PRIVACY: Document = {
  title: "Privacy policy",
  updated: "Last updated: 2 August 2026",
  body: [
    "This explains what we keep, why, and what you can do about it. It was written by reading the database, not a template.",

    "**What we keep.** Your email and password (encrypted; we cannot see it). Your name, your photo if you upload one, your time zone, your language and the hours you want to pray. What you answer during onboarding: what you are going through and what you would like to pray about. Your prayer plans and the days you have marked. Your requests, testimonies, comments and messages. Who you share each thing with, who you follow, and who you have blocked.",

    "**What we do NOT keep.** We do not ask for your location, your contacts, your microphone, or your camera except when you pick a profile photo. There is no advertising and we do not sell data to anyone.",

    "**Who sees your things.** The database decides, not a screen: every plan, testimony and request carries its own visibility, and the rules are enforced on the server. Nobody else sees a private plan. The prayer you write in the first person never travels to whoever prays for you, not even with a shared plan. An anonymous request carries neither your name **nor your identifier**, so two anonymous requests of yours cannot be linked to each other.",

    "**Artificial intelligence.** To write your plan we send Anthropic (the Claude model) your onboarding answers and the plan's topic. We do not send your name, your email or your prayer requests. Anthropic does not use that data to train its models.",

    "**Where it lives.** On Supabase, running on Amazon Web Services infrastructure. Avatars sit in public storage: anyone with the exact URL can see them, so do not upload anything there you would not want seen.",

    "**For how long.** As long as you have an account. When you delete it, everything of yours is deleted. Public links you created expire on their own.",

    "**Your rights.** You can see, correct and delete your data from inside the app, and export it to a file. If you are in the European Union you can also object to processing and complain to your data protection authority.",

    "**Minors.** The app is not aimed at children under 13 and we do not knowingly collect their data.",

    "**Write to us.** hola@ammen.app",
  ],
};

export const LEGAL_DOCUMENTS = {
  terms: { es: ES_TERMS, en: EN_TERMS },
  privacy: { es: ES_PRIVACY, en: EN_PRIVACY },
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

/** Cae al español, que es el idioma en el que está escrita la app. */
export const legalDocument = (key: LegalDocumentKey, language: string) =>
  LEGAL_DOCUMENTS[key][language.startsWith("en") ? "en" : "es"];
