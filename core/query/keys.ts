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

/** Un id que puede faltar mientras carga la sesión (`undefined` o `null`): la query queda deshabilitada. */
type Id = string | null | undefined;

/** Una clave con raíz: `qk.x(a, b)` da la clave entera, `qk.x.root` el prefijo. */
const key = <Args extends Part[]>(root: string) =>
  Object.assign((...args: Args) => [root, ...args] as const, {
    root: [root] as const,
  });

export const qk = {
  // -- Configuración remota ---------------------------------------------------
  featureFlag: key<[flag: string]>("featureFlag"),

  // -- Cuenta y perfil -------------------------------------------------------
  activePlan: key<[userId: Id]>("activePlan"),
  blocks: key<[userId: Id]>("blocks"),
  emailPreferences: key<[userId: Id]>("emailPreferences"),
  emailPreferencesToken: key<[token: Id]>("emailPreferencesToken"),
  inviteCode: key<[userId: Id]>("inviteCode"),
  invitePreview: key<[code: Id]>("invitePreview"),
  onboarding: key<[userId: Id]>("onboarding"),
  onboardingAnswers: key<[userId: Id]>("onboardingAnswers"),
  plusWaitlist: key<[userId: Id]>("plusWaitlist"),
  profile: key<[userId: Id]>("profile"),
  publicProfile: key<[userId: Id]>("publicProfile"),
  pushPermission: key<[]>("pushPermission"),
  streak: key<[userId: Id]>("streak"),

  // -- Biblia ----------------------------------------------------------------
  bibleBooks: key<[]>("bibleBooks"),
  bibleChapter:
    key<
      [version: string, bookId: number | undefined, chapter: number | undefined]
    >("bibleChapter"),
  bibleReference: key<[query: string]>("bibleReference"),
  bibleSearch: key<[query: string]>("bibleSearch"),
  chapterMarks:
    key<[userId: Id, bookId: number | undefined, chapter: number | undefined]>(
      "chapterMarks",
    ),
  readingPosition: key<[userId: Id]>("readingPosition"),
  verseOfTheDay: key<[]>("verseOfTheDay"),

  // -- Planes ----------------------------------------------------------------
  myPlans: key<[userId: Id]>("myPlans"),
  planCircles: key<[planId: Id]>("planCircles"),
  planDay: key<[planId: Id, dayNumber: number | undefined]>("planDay"),
  planDays: key<[planId: Id]>("planDays"),
  planProgress: key<[planId: Id]>("planProgress"),
  planQuota: key<[userId: Id]>("planQuota"),
  planShareLink: key<[planId: Id]>("planShareLink"),
  planSummary: key<[planId: Id]>("planSummary"),
  prayedToday: key<[dayId: Id]>("prayedToday"),
  publicPlanDay: key<[planId: Id]>("publicPlanDay"),
  sharePreview: key<[token: Id]>("sharePreview"),
  sharedPlanDay: key<[planId: Id]>("sharedPlanDay"),
  sharedWithMe: key<[userId: Id]>("sharedWithMe"),
  todayDay: key<[planId: Id]>("todayDay"),
  whoPrayedForMe: key<[userId: Id]>("whoPrayedForMe"),
  prayerList: key<[userId: Id]>("prayerList"),
  personPlans: key<[userId: Id]>("personPlans"),

  // -- Círculos y chat -------------------------------------------------------
  canCreateCirclePlan: key<[circleId: Id]>("canCreateCirclePlan"),
  circle: key<[circleId: Id]>("circle"),
  circleConversation: key<[circleId: Id]>("circleConversation"),
  circleInvite: key<[token: Id]>("circleInvite"),
  circleInviteToken: key<[circleId: Id]>("circleInviteToken"),
  circleMembers: key<[circleId: Id]>("circleMembers"),
  circleMessages: key<[circleId: Id]>("circleMessages"),
  circlePlan: key<[circleId: Id]>("circlePlan"),
  circleSharedPlans: key<[circleId: Id]>("circleSharedPlans"),
  circles: key<[userId: Id]>("circles"),
  publicCircles: key<[search: string]>("publicCircles"),
  unreadCounts: key<[userId: Id]>("unreadCounts"),

  // -- Comunidad -------------------------------------------------------------
  homeFeed: key<[]>("homeFeed"),
  personPosts: key<[userId: Id]>("personPosts"),
  postComments: key<[postId: Id]>("postComments"),
  searchPeople: key<[search: string]>("searchPeople"),
  testimonies: key<[userId: Id]>("testimonies"),

  // -- Avisos ----------------------------------------------------------------
  notifications: key<[userId: Id]>("notifications"),
  unreadNotifications: key<[userId: Id]>("unreadNotifications"),

  // -- Moderación ------------------------------------------------------------
  crisisQueue: key<[userId: Id]>("crisisQueue"),
  openReports: key<[userId: Id]>("openReports"),
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
