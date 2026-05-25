content = """# Qiko Chat - Refactoring & Architecture Implementation Plan

**Cilj:** Transformisati trenutni monolitni `popup.js` i `background.js` u čistu, modularnu ES6 arhitekturu. Cilj je uvesti centralizovano upravljanje greškama, odvojiti UI od logike, i zamijeniti privremeni Firebase "Inbox" sistem sa pravim WebRTC (PeerJS) Peer-to-Peer rješenjem.

**Instrukcije za AI Agenta:** - Prati striktno ovaj redoslijed. 
- Ne prelazi na sljedeći korak dok prethodni nije u potpunosti implementiran, testiran i potvrđen.
- Prvo lociraj i mapiraj sve postojeće funkcije iz trenutnog koda prije nego što ih obrišeš.

---

### Korak 1: Mapiranje i Centralizacija Konstanti (Enums & Endpoints)
**Akcija:** Kreirati dva nova fajla u `/lib` ili root folderu: `constants.js` i `api-endpoints.js`.
1. **`constants.js` (DOM Enums):**
   - Lociraj apsolutno sve HTML ID-jeve koji se koriste u `popup.js` (npr. `btn-create-id`, `screen-loading`, `chat-message-input`).
   - Kreiraj i eksportuj `const DOM_IDS = { ... }` objekat koji će služiti kao Enum. Nema više hardkodiranih stringova u funkcijama.
2. **`api-endpoints.js` (Google URLs):**
   - Izdvoj sve hardkodirane URL stringove (Identity Toolkit i Firebase RTDB).
   - Svaki URL mora imati detaljan komentar iznad koji objašnjava šta tačno taj endpoint radi u pozadini.

### Korak 2: Univerzalni API Wrapper (DRY princip)
**Akcija:** Kreirati fajl `api-client.js`.
- **Zadatak:** Umjesto 15 različitih `fetch` funkcija sa ponovljenim `if (!response.ok)` i `try-catch` blokovima, napraviti jednu univerzalnu metodu: 
  `async function callApi(endpoint, method = 'POST', body = null, token = null)`
- **Logika:** Ova metoda mora sama da rješava parsiranje JSON-a i hvatanje grešaka. Ako `response.ok` nije true, metoda automatski baca strukturiranu grešku (`throw new Error(...)`) koju će UI kasnije uhvatiti. Sve Firebase funkcije od sada koriste isključivo ovaj wrapper.

### Korak 3: Odvajanje Firebase Logike
**Akcija:** Kreirati `firebase-auth.js` i `firebase-db.js`.
- **`firebase-auth.js`:** Prebaciti funkcije za anonimnu prijavu, registraciju mailom, verifikaciju i linkovanje naloga. Sve one sada pozivaju `callApi` iz Koraka 2.
- **`firebase-db.js`:** Prebaciti funkcije za kreiranje Qiko ID-a u bazi, spašavanje identiteta, čitanje `last_seen` statusa i upravljanje kontaktima.

### Korak 4: UI Menadžer (Zaseban modul)
**Akcija:** Kreirati `ui-manager.js`.
- **Zadatak:** Ovaj fajl je jedini koji smije da dira DOM (čita inpute, dodaje klase, mijenja HTML).
- Implementirati funkciju `toggleScreens(screensToShow, screensToHide)` koja prima nizove i pali/gasi CSS klase.
- Implementirati metodu `showError(message)` koja prikazuje korisniku smislene poruke na interfejsu umjesto običnog ispisa u konzolu.
- Implementirati metodu `renderContacts(contactsList)`.

### Korak 5: Uvođenje pravog WebRTC (PeerJS) Chata
**Akcija:** Kreirati `chat-engine.js` i ažurirati `background.js`.
- **Zadatak:** Očistiti kod od starog Firebase "Inbox" sistema (brisanje `/inbox` rute i onog SSE `.getReader()` stream koda).
- Inicijalizovati PeerJS instancu (koristeći korisnikov Qiko ID ili Firebase UID).
- Napraviti metode: `connectToPeer(peerId)`, `sendMessage(peerId, text)`, i event listenere za `peer.on('connection')` i `conn.on('data')`.
- Sada poruke lete direktno između dva browsera (prava enkripcija, nulti otisak na serveru).

### Korak 6: Otkucaji Srca i Integracija (`popup.js` Controller)
**Akcija:** Očistiti `popup.js` tako da postane samo glavni Controller.
- Uvezati sve module: `ui-manager` hvata klik na dugme, zove metodu iz `firebase-auth`, koja koristi `api-client`. Ako uspije, `ui-manager` mijenja ekran.
- Zadržati pingovanje (Presence) gdje korisnik ažurira svoj `last_seen` na svakih 60 sekundi.
"""

with open("/tmp/Qiko_Implementation_Plan.md", "w", encoding="utf-8") as f:
    f.write(content)

print("[file-tag: Qiko_Implementation_Plan.md]")