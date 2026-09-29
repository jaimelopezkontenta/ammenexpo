/**
 * Las claves de React Query, en un solo sitio.
 *
 * Había 172 `queryKey: [...]` sueltos en 61 raíces. Una clave escrita a mano en
 * un `invalidateQueries` y otra distinta en el `useQuery` que debía refrescar
 * fallan en silencio: la pantalla se queda con el dato viejo (así había dos
 * invalidaciones, `["openHolds"]` y `["openCrisis"]`, que no refrescaban nada
 * porque ninguna query las usaba). Aquí cada clave se define una vez, con los
 * tipos de sus parámetros, y el resto del código solo la llama.
 *
 * Uso:
 *   useQuery({ queryKey: qk.myPlans(userId), … })       // la clave entera
 *   invalidateQueries({ queryKey: qk.myPlans(userId) }) // esa
 *   invalidateQueries({ queryKey: qk.sharedWithMe.root }) // todas las de la raíz
 *
 * Los valores de las claves son EXACTAMENTE los que había antes: cambiar uno
 * cambiaría qué se cachea y qué se invalida. `core/query/keys.test.ts` fija los
 * valores y prohíbe (ESLint) escribir un `queryKey` literal fuera de este fichero.
 */

type Part = string | number | boolean | null | undefined;

/** Una clave con raíz: `qk.x(a, b)` da la clave entera, `qk.x.root` el prefijo. */
const key = <Args extends Part[]>(root: string) =>
  Object.assign((...args: Args) => [root, ...args] as const, {
    root: [root] as const,
  });

export const qk = {
  // -- Cuenta y perfil -------------------------------------------------------
  activePlan: key<[userId: string | undefined]>("activePlan"),
  blocks: key<[userId: string | undefined]>("blocks"),
  emailPreferences: key<[userId: string | undefined]>("emailPreferences"),
  emailPreferencesToken: key<[token: string | undefined]>(
    "emailPreferencesToken",
  ),
  inviteCode: key<[userId: string | undefined]>("inviteCode"),
  invitePreview: key<[code: string | undefined]>("invitePreview"),
  onboarding: key<[userId: string | undefined]>("onboarding"),
  onboardingAnswers: key<[userId: string | undefined]>("onboardingAnswers"),
  plusWaitlist: key<[userId: string | undefined]>("plusWaitlist"),
  profile: key<[userId: string | undefined]>("profile"),
  publicProfile: key<[userId: string | undefined]>("publicProfile"),
  pushPermission: key<[]>("pushPermission"),
  streak: key<[userId: string | undefined]>("streak"),

  // -- Biblia ----------------------------------------------------------------
  bibleBooks: key<[]>("bibleBooks"),
  bibleChapter:
    key<
      [version: string, bookId: number | undefined, chapter: number | undefined]
    >("bibleChapter"),
  bibleReference: key<[query: string]>("bibleReference"),
  bibleSearch: key<[query: string]>("bibleSearch"),
  chapterMarks:
    key<
      [
        userId: string | undefined,
        bookId: number | undefined,
        chapter: number | undefined,
      ]
    >("chapterMarks"),
  readingPosition: key<[userId: string | undefined]>("readingPosition"),
  verseOfTheDay: key<[]>("verseOfTheDay"),

  // -- Planes ----------------------------------------------------------------
  myPlans: key<[userId: string | undefined]>("myPlans"),
  planCircles: key<[planId: string | undefined]>("planCircles"),
  planDay:
    key<[planId: string | undefined, dayNumber: number | undefined]>("planDay"),
  planDays: key<[planId: string | undefined]>("planDays"),
  planProgress: key<[planId: string | undefined]>("planProgress"),
  planQuota: key<[userId: string | undefined]>("planQuota"),
  planShareLink: key<[planId: string | undefined]>("planShareLink"),
  planSummary: key<[planId: string | undefined]>("planSummary"),
  prayedToday: key<[dayId: string | undefined]>("prayedToday"),
  publicPlanDay: key<[planId: string | undefined]>("publicPlanDay"),
  sharePreview: key<[token: string | undefined]>("sharePreview"),
  sharedPlanDay: key<[planId: string | undefined]>("sharedPlanDay"),
  sharedWithMe: key<[userId: string | undefined]>("sharedWithMe"),
  todayDay: key<[planId: string | undefined]>("todayDay"),
  whoPrayedForMe: key<[userId: string | undefined]>("whoPrayedForMe"),
  prayerList: key<[userId: string | undefined]>("prayerList"),
  personPlans: key<[userId: string | undefined]>("personPlans"),

  // -- Círculos y chat -------------------------------------------------------
  canCreateCirclePlan: key<[circleId: string | undefined]>(
    "canCreateCirclePlan",
  ),
  circle: key<[circleId: string | undefined]>("circle"),
  circleConversation: key<[circleId: string | undefined]>("circleConversation"),
  circleInvite: key<[token: string | undefined]>("circleInvite"),
  circleInviteToken: key<[circleId: string | undefined]>("circleInviteToken"),
  circleMembers: key<[circleId: string | undefined]>("circleMembers"),
  circleMessages: key<[circleId: string | undefined]>("circleMessages"),
  circlePlan: key<[circleId: string | undefined]>("circlePlan"),
  circleSharedPlans: key<[circleId: string | undefined]>("circleSharedPlans"),
  circles: key<[userId: string | undefined]>("circles"),
  publicCircles: key<[search: string]>("publicCircles"),
  unreadCounts: key<[userId: string | undefined]>("unreadCounts"),

  // -- Comunidad -------------------------------------------------------------
  homeFeed: key<[]>("homeFeed"),
  personPosts: key<[userId: string | undefined]>("personPosts"),
  postComments: key<[postId: string | undefined]>("postComments"),
  searchPeople: key<[search: string]>("searchPeople"),
  testimonies: key<[userId: string | undefined]>("testimonies"),

  // -- Avisos ----------------------------------------------------------------
  notifications: key<[userId: string | undefined]>("notifications"),
  unreadNotifications: key<[userId: string | undefined]>("unreadNotifications"),

  // -- Moderación ------------------------------------------------------------
  crisisQueue: key<[userId: string | undefined]>("crisisQueue"),
  openReports: key<[userId: string | undefined]>("openReports"),
  reportQueue: key<[status: string]>("reportQueue"),

  // -- Claves con una forma propia --------------------------------------------
  /** El muro abierto no tiene círculo: su clave lleva `"wall"`, no `undefined`. */
  prayerFeed: Object.assign(
    (circleId?: string) => ["prayerFeed", circleId ?? "wall"] as const,
    { root: ["prayerFeed"] as const },
  ),
  /** Los estados van en una sola cadena para que la clave sea estable. */
  heldContentQueue: Object.assign(
    (statuses: readonly string[]) =>
      ["heldContentQueue", statuses.join(",")] as const,
    { root: ["heldContentQueue"] as const },
  ),
} as const;
