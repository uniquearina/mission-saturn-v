> **Сейчас не нужно.** С 3 октября 2026 ИИ-портрет доступен только семье владельца (вход по списку доверенных почт), остальные делают «фото в шлеме» на устройстве. Письмо понадобится, только если ИИ-портрет когда-нибудь откроем всем.

# Письмо в OpenAI: просьба включить Zero Data Retention

Куда: форма связи с отделом продаж — https://openai.com/contact-sales (или через help.openai.com → чат → «API» → «Zero Data Retention»).
От кого: с той почты, на которую зарегистрирован аккаунт OpenAI с ключом игры.
В поле Organization ID — id организации из https://platform.openai.com/settings/organization/general

---

**Subject:** Zero Data Retention request — children's educational coding game (images/edits, gpt-image)

Hello,

I'm building "Mission Saturn V", a small browser game that teaches children (ages 6–9) to write real Python by flying a drone that assembles the Saturn V rocket.

One optional feature uses the Images API (`/v1/images/edits`, model gpt-image-2): a parent uploads a photo of their child, and we generate a 1969-style astronaut portrait of the child for the in-game flight log. The feature is available only to signed-in parents, after an explicit consent notice; we never send names or other data with the image.

Your under-18 guidance says that personal data of children under 13 should not be processed without Zero Data Retention. To comply, I'd like to request Zero Data Retention for my organization:

- Organization ID: org-…
- Endpoint: `/v1/images/edits` (gpt-image-2), no other endpoints with children's data
- Expected volume: low (under ~60 images per day, a hard limit in our backend)
- Users: currently my own family; later possibly public, with verifiable parental consent

Until ZDR is enabled, the portrait feature stays limited to my own family account.

Could you tell me whether my organization is eligible and what the next steps are?

Thank you,
Arina
