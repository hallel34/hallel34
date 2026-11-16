# MaxiFox 0.5.0: Families policy check of the weekly "seniority" mechanic

Date: 2026-11-11. Owner: sales (monetization and policy). Scope: the career "ותק" rule only. Nothing in `src/` was edited and nothing was committed.

This is a desk review by a non-lawyer. It is not legal advice and not a Google or Apple pre-approval (section 8).

## 0. The mechanic as reviewed

Source: `docs/MaxiFox_v0.5_Plan.md` section 5, `docs/v050/design/career-spec.md`, `docs/v050/career-copy.md`.

- Week = Sunday to Saturday. A week with no finished game resets the progress bar toward the next rank. Two missed weeks in a row drop every profession one rank on return.
- Age band is picked on a profile: "up to 10", "11-13", "14+". Up to 10 loses nothing (the career "waits"). A device with no profile is treated as junior (nothing lost).
- No push, no app-icon badge, no interrupting modal. Warnings appear only on screens the player opens anyway.
- No purchase, rewarded ad, or timer can restore, protect or speed up seniority.
- Copy rules: no "lost/failed/missed" words, a once-per-event return screen that opens with "good to see you again", a labelled "game rule" line.

Facts that matter for the policy reading:
- CLAUDE.md says Family mode is for ages ~9+. So under-13 players are an intended audience, not an accident. If the Play target audience includes any age group under 13, the Families policy applies to the whole app, not only to the junior profile.
- The age band is self-declared and unverified. Age 11-13 is under 13 for COPPA and for Google's "children", yet gets the full loss rule in the current design.

## 1. Method and a caveat on the sources

I fetched each page on 2026-11-11 through a fetch tool that returns a summary produced by a small model, not the raw page. The quotes below are what that tool returned as quotes. Short quotes are very likely accurate, but **re-read each page yourself before relying on a quote**. No Google or Apple page shows a "last updated" date, only "(c) 2026 Google", so "accessed" below is the only date I can give. Where a source is a law-firm or trade summary instead of the primary text, it is marked.

## 2. Google Play: policy by policy

### 2.1 Families policy requirements (the main page)
URL: https://support.google.com/googleplay/android-developer/answer/9893335 (accessed 2026-11-11; no revision date shown).

Relevant wording (as returned):
- "If one of the target audiences for your app is children, you must comply with the following requirements." Failure "may result in app removal or suspension."
- Age-appropriate design: "Your app's content that is accessible to children must be appropriate for children."
- Ads and monetization: "Google Play reserves the right to reject, remove or suspend apps for overly aggressive commercial tactics." The section covers "all monetization and advertising in your app, including ads, cross-promotions ..., offers for in-app purchases, or any other commercial content."
- Prohibited when the app targets only children, or when serving children or users of unknown age in a mixed-audience app (the list as summarised): disruptive ads; rewarded or opt-in ads that cannot be closed after 5 seconds when they interfere with gameplay; interstitials shown immediately on app launch; several ad placements on one page; ads not clearly distinct from content; "shocking or emotionally manipulative tactics to encourage ads viewing or in-app purchases"; deceptive dismiss buttons; and failing to distinguish virtual game coins from real-money purchases.
- Target audience: "you must indicate the target audience for your app, prior to publishing." Picking age groups that include both adults and children is fine only if the app is really designed for all of them. Imagery or wording that appeals to children can change Google's view of the declared audience.
- Mixed audience: "you must include a neutral age screen" (the policy ties this to ad SDK use, see 2.4).

**Does the seniority mechanic conflict?** Not on the text.
- The manipulation clause is limited to "encourage ads viewing or in-app purchases". The mechanic is tied to neither. So it is outside the clause as written.
- I found **no sentence in the Families policy that names streaks, loss aversion, login rewards, or engagement loops.** Absence of a rule is not approval: the content clause ("appropriate for children") is a judgement call by the reviewer, and "overly aggressive commercial tactics" is discretionary.
- The mechanic would become a **clear violation** the moment it is connected to money: a purchase or rewarded ad to "save your rank", "restore progress", "freeze the week" or "skip the wait". Section 6 turns this into a hard rule.

### 2.2 The spammy-and-manipulative addition (history)
URL: https://support.google.com/googleplay/android-developer/answer/14554577 (accessed 2026-11-11).
Wording: "We've updated our Families Ads and Monetization policy to prohibit spammy and manipulative ads and monetization practices." The page dates the announcement to April 16, 2020. A search snippet shows a later clarification of the same clause; I did not find its date. This confirms the clause is about ads and monetization, not game mechanics.

### 2.3 Ads policy (general)
URL: https://support.google.com/googleplay/android-developer/answer/9857753 (accessed 2026-11-11).
Paraphrase: ads count as part of the app ("We consider ads and associated offers as part of your app"); unexpected full-screen interstitials (for example during gameplay) are restricted; repeated interstitials meant to distract from in-app tasks are not allowed; disruptive ads "that may result in inadvertent clicks" are not allowed; rewarded ads the user explicitly opts into are exempt from the 15-second rule.
**Conflict:** none for the mechanic. **Interaction:** the once-per-event "welcome back" screen opens at app launch. Under the Families list (2.1) an interstitial "immediately on app launch" is prohibited for children. So that screen, and the home screen on launch, must never carry an ad.

### 2.4 Families Self-Certified Ads SDK program
URL: https://support.google.com/googleplay/android-developer/answer/9283445 (accessed 2026-11-11).
Wording: apps targeting children must use certified SDK versions; mixed-audience apps "are allowed to use non-certified ads SDKs for serving ads only to users who are not children"; apps "that do not serve ads to children are not required to use a Families self-certified ads SDK"; "it is your responsibility to ensure that any SDK you implement in your app is compliant."
**Conflict:** none. **Interaction:** the age band on the profile is not a neutral age screen (the chips show ranges and are labelled). If ads are shown to the 14+ band only, a neutral age screen (for example a birth year with no hint of the "right" answer) is needed to rely on it. The simplest route is to show no ads to anyone in a Families-listed app, which is a product choice for the owner.

### 2.5 Designed for Families program
I could not retrieve a live page for the program's own requirements (the URL I tried, answer/9285071, returned 404; the short link goo.gle/families appeared in search but I did not fetch it). **I have no verified wording for this program.** I am not citing anything from memory. Open item for a human (section 8).

### 2.6 Privacy and data (Play Families)
Same page as 2.1. Wording: "You must disclose the collection of any personal and sensitive information from children in your app"; apps that solely target children "must not transmit Android advertising identifier (AAID)"; a privacy policy that "accurately reflects data collection and handling practices" is required.
**Conflict:** none today. The mechanic needs only a "last finished game" date and per-profile ranks, all in `localStorage` (the sales doc says no personal data is collected). It **would** conflict if the profile name, age band or career events were sent to a server or an analytics tool. See section 5 for 0.5.2 (Firebase rooms) and the planned post-release events.

### 2.7 Play: what I did not find
No Play policy page I could reach has wording on: streaks, loss aversion, "dark patterns" as a term, daily or weekly return rewards, or push notifications to children. So "does Play ban this" is answered by **inference**, not by a rule. I searched for the term "dark patterns" with Families and found no hit.

## 3. Apple App Store (secondary)

URL: https://developer.apple.com/app-store/review/guidelines/ (accessed 2026-11-11; no revision date in the text I got; the page was long and the tool read only the first 100,000 of about 114,000 characters).

- 1.3 Kids Category: apps "must not include links out of the app, purchasing opportunities, or other distractions to kids unless reserved for a designated area behind a parental gate." Kids Category apps "may not send personally identifiable information or device information to third parties" and "should not include third-party analytics or third-party advertising" (narrow exceptions for contextual ads and analytics that collect no identifiers).
- 5.1.4 Kids: review COPPA and GDPR; birthdate and parent contact may be requested "only for the purpose of complying with these statutes"; a privacy policy is needed; and the parental gate "is generally not the same as securing parental consent."
- 2.5.18: no targeted or behavioural advertising "from kids (such as from apps in the App Store's Kids Category)".
- 2.3.8 (as quoted in 5.1.4): terms like "For Kids" in metadata are reserved for the Kids Category. An app that is not in the category cannot imply that children are the main audience.

**Conflict:** none on the mechanic. Apple's text has no rule on streaks or loss framing. Its constraints bite on money and data: in the Kids Category, no ads and no purchase button outside a parental gate; no third-party analytics. If MaxiFox is not put in the Kids Category, 2.3.8 limits child-targeted wording in the listing (a marketing point, not a mechanic point).
I did not retrieve Apple's age-band list for the Kids Category; I do not state it here.

## 4. Privacy and child-design frameworks (secondary)

| Source | What it says (as retrieved) | Conflict with the mechanic? |
|---|---|---|
| **COPPA**, FTC FAQ https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions (accessed 2026-11-11) | "Mixed audience" is a subcategory of "directed to children"; operators can age-screen but cannot block under-13s. Persistent identifiers count as personal information. The Rule "was amended on April 22, 2025". A law-firm and trade-association summary (not the primary text) gives an effective date of 2025-06-23 and a full compliance date of 2026-04-22, which has now passed. | No. COPPA regulates collection of personal information, not game mechanics. Local-only storage collects nothing. Relevant if analytics, accounts or Firebase carry identifiers. |
| **ICO Children's Code, Standard 13 "Nudge techniques"** https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/ (accessed 2026-11-11; no date shown) | "Do not use nudge techniques to lead or encourage children to provide unnecessary personal data" or turn off privacy protections. Defines nudges as "design features which lead or encourage users to follow the designer's preferred paths." Suggests nudging toward wellbeing, such as taking breaks. It **does not mention rewards, streaks, or loss framing** on that page. | Not directly. It is about data and privacy settings. It is UK law and applies when a service is likely to be accessed by UK children. The spirit (do not steer children) is relevant. |
| **EU Commission guidelines on protecting minors, DSA Art. 28**, published 14 July 2025 https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors (accessed 2026-11-11; the page shows a "Last update" of 22 April 2026) | Recommends disabling by default, for minors, features that contribute to excessive use, "including communication 'streaks'", and listing push notifications, autoplay, ephemeral content and read receipts. Recommends removing "persuasive design features aimed predominantly at engagement." Non-binding. Law-firm summaries (not the primary text) add that following them gives no presumption of compliance. | **Closest thing to a direct hit, with limits.** Art. 28 applies to *online platforms* (services that store and spread user content), and MaxiFox v1 is an offline single-player game, so it is probably out of scope. The 0.5.1 challenge links and 0.5.2 live rooms are the part to watch. The text is about *communication* streaks. I did not read the full guideline text, so I cannot say whether a weekly progress-loss rule is covered. It signals the direction of regulators: loss-based return pressure on minors is the sort of thing they discuss. |
| **ICO games "top tips"**, 16 Feb 2023 (found through law-firm summaries only; I did not retrieve the ICO page) | Natural breaks, prompts to take breaks, positive nudges. Streak or reward-loop wording **not found**. | Not established. |
| **Israel Privacy Protection Law, Amendment 13**, in force 14 Aug 2025 (law-firm summaries, e.g. https://www.mondaq.com/privacy-protection/1709950/major-amendment-to-privacy-law-in-israel; not the statute) | Larger enforcement powers and fines. I found **no age threshold or minor-specific rule** in what I retrieved. One summary says there is no dedicated child-consent age. | No, for local-only data. Israeli rules on children and consumers more broadly (for example consumer protection on misleading practices aimed at minors) were **not researched**. Needs Israeli counsel. |
| **GDPR-K** (Art. 8) | Not fetched. I do not state the per-country consent ages. | Same logic as COPPA: about data, not mechanics. Needs counsel if EU launch happens. |

## 5. The part that is not about the mechanic: data and money around it

1. **0.5.2 live rooms (Firebase)** and the **post-release anonymous events** (decisions.md 2026-11-08) are the real policy exposure. Rules for this feature: never send age band, profile name, rank, or "weeks missed" off the device; no event named after a loss ("lost_rank"); the Families check the owner already required must cover the event list before it ships.
2. **Coins in junior mode.** Play lists "failing to distinguish virtual game coins from real-money purchases". Junior coins are only a display unit of 100 shekels and are never sold. Keep it that way: no purchasable coins, no coin reward for returning.
3. **Rewarded ads and the 5-second rule** (2.1): the existing rewarded placements (interest-free loan, re-roll, peek) must be closable within 5 seconds in any Families-listed build. This is outside the mechanic but should be fixed in `monetization.md` and `ad-hooks-for-dev.md`.

## 6. Mitigations (ordered by value)

**A. Hard rules, no cost to the product (do these regardless)**
1. **Never link money or ads to seniority.** No IAP, rewarded ad, coupon, "freeze", "restore" or "booster" touching rank, progress, week state, or the promotion week. No ads on the welcome-back screen or the seniority screen. Write this into `monetization.md` as a rule so that a future pricing idea cannot break it.
2. **No notifications of any kind**, including local notifications (Capacitor LocalNotifications) and PWA push. The plan says "no push"; make it "no notification permission requested". The EU guideline text lists push notifications among default-off features.
3. **No timers sold, no countdown as a pressure device.** Day counts are facts ("until Saturday") and should stay plain text, no flashing, no amber-on-red escalation for anyone under 14.
4. **Keep the data on the device.** No career data in analytics or Firebase (section 5).

**B. Age guard: move the protection from 10 to 13 (recommended)**
- Why: Google's "children" and COPPA's "under 13" cover the 11-13 band, and Families treats the whole app as child-directed when that band is a target. The design already has an "11-13" chip, so the change is to stop treating it as "full loss rule". Cost: one config value.
- Honest limits: age is self-declared. A child who picks "14+" (for example to get Full mode with stocks) gets the loss rule. Options:
  - **Option 1 (safest):** the rule is **opt-in for everyone**, default off, labelled "ותק שבועי (אופציונלי)". Nobody can lose anything by accident.
  - **Option 2:** on by default for 14+ only, with a visible, one-tap "pause my career" (vacation mode) setting available to every profile, and the first career screen says plainly what the rule is before it can apply.
  - **Option 3 (current design):** guard stops at 10. I rate this the highest review risk of the three, because 11-12 are under 13.
  The owner decided "up to 10" on 2026-11-10. This is a recommendation to revisit that decision with the evidence above, not a change I made. It is a product and money-adjacent call: the CEO and owner decide.
- No profile or unknown age = junior (already in the spec, keep).
- When a profile moves from a protected band to an unprotected one, show the rules before they apply (the `fromAge11` string already exists; the new threshold would use it for 14).

**C. Wording**
- The existing copy is good: states the rule before it applies, one factual warning sentence, no "you lost/failed", no fake urgency, a return screen that opens with "good to see you again", an honest "game rule" label. Keep it.
- Rename "ותק" if possible. The educator's own note says real seniority is not erased by a week off, so the name over-claims; "רצף שבועי" or "קצב קריירה" says less and is more honest. A false-name risk is a consumer-protection point, not a Play rule.
- Do not make the junior promise absolute: the spec already says "it waits", not "you can't lose". Keep it.
- Parent line: one line in settings for parents ("Under 14, nothing is lost; the career only waits"), updated to match whichever age guard is chosen.

**D. Design**
- No amber or red state, no day counter and no "last chance" framing for any profile in a protected band. Show the same calm chip as junior.
- No streak-style celebration of "do not break it". Reward the doing (a finished game, a lesson) not the not-missing.
- Add a **pause** (vacation mode) for everyone, with no cost and no expiry nag. This also answers the EU wellbeing and break-friendly direction.
- Store listing and in-app text must not promise "compete to keep your rank", and marketing must not call the game "for kids" if it is not in the Kids Category (Apple 2.3.8).

## 7. Conclusion

**Does the mechanic conflict with Google Play Families policy as written?** No explicit conflict that I could find, for any age, as long as it stays disconnected from ads and purchases. Google's text does not name streaks or loss mechanics. The manipulation clause is limited to ads and in-app purchases.

**Is it low-risk?**
- **Junior (up to 10): low risk.** Nothing is lost, nothing pushes, no money link.
- **11-12 (the 11-13 band) under the current design: medium risk.** The content clause ("appropriate for children") is a reviewer's judgement. A weekly loss rule applied to under-13s is the kind of design regulators (EU guidelines, ICO's general direction) criticise, even though no Google rule names it. A reviewer who dislikes it can cite "overly aggressive" tactics or content suitability, and I cannot rule that out.
- **Apple:** no conflict on the mechanic. The Kids Category constraints are about ads, purchases and analytics.
- **Data law (COPPA, GDPR-K, Israel):** no conflict while data stays local. This changes if age band or career events leave the device.

**Confidence.**
- No textual Play conflict for the mechanic itself: **medium-high** (I read the relevant pages through a summarising tool, and found no wording, but I did not read the full pages or the Designed for Families program text).
- Reviewer will not flag the 11-12 exposure: **low to medium**. This is the weakest point and I would not bet on it.
- Statements on COPPA dates, the EU guideline and Israeli law: **medium** (secondary summaries in part).

**Recommendation:** adopt A (hard rules) now; move the age guard to 13 or make the rule opt-in (B); revisit the name (C). Under those changes I would put the mechanic at low risk.

## 8. What still needs a human or legal check

1. **Re-read the primary pages** (section 1 caveat), especially Play "Families" and "Designed for Families" in the live Play Console help. I could not retrieve the Designed for Families page.
2. **Pick the Play target audience and content rating** deliberately. Which age groups are ticked decides how much of the app counts as child-directed. A lawyer or the CEO and owner should decide this before the declaration, since it can be changed later but misdeclaring risks removal.
3. **Israeli counsel** on: minors and consent under the amended Privacy Protection Law, consumer-protection rules on practices aimed at minors, and whether a loss-of-progress rule for under-18s raises any issue. Not researched here.
4. **EU/UK exposure** if the app is released there: whether the live rooms (0.5.2) make the app an "online platform" under DSA Art. 28; GDPR-K consent age per country; UK Children's Code applicability. Needs counsel.
5. **Apple:** the decision to enter the Kids Category (it forbids ads, third-party analytics and ungated purchases) and Apple's current age bands. Not retrieved.
6. **A reviewer-style test with a few parents** in the playtest group the owner already planned (decisions.md 2026-11-08): ask specifically how 11-12-year-olds react to the reset and drop screens. That is evidence no policy page can give.
7. **Analytics event list** for the post-release measurement, against the Families rules, before it ships (already required by the owner).

## 9. Sources (all accessed 2026-11-11)

- Google Play, Families policy requirements: https://support.google.com/googleplay/android-developer/answer/9893335
- Google Play, Ads policy: https://support.google.com/googleplay/android-developer/answer/9857753
- Google Play, Families Self-Certified Ads SDK Program: https://support.google.com/googleplay/android-developer/answer/9283445
- Google Play, policy update history (2020 manipulative-ads clause): https://support.google.com/googleplay/android-developer/answer/14554577
- Apple, App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- FTC, COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- ICO, Children's Code standard 13: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/
- European Commission, guidelines on protection of minors (DSA Art. 28): https://digital-strategy.ec.europa.eu/en/library/commission-publishes-guidelines-protection-minors
- Secondary, Israel Amendment 13: https://www.mondaq.com/privacy-protection/1709950/major-amendment-to-privacy-law-in-israel
- Secondary, COPPA amended-rule dates: https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect and https://www.toyassociation.org/PressRoom2/News/2026-News/updated-coppa-rule-requirements-take-effect-april-22.aspx
