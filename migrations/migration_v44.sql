-- =============================================================
--  KULMI migration v44 — seed the Journal with guidance articles. Idempotent
--  (fixed ids + on conflict do nothing; safe to re-run, edits in admin survive).
-- =============================================================

insert into public.posts (id, title, excerpt, content, published) values
(
  'a0000000-0000-4000-8000-000000000001',
  'How to stay safe while looking for marriage online',
  'Practical, honest safety guidance from us to you — what to share, what to hold back, and how Kulmi protects you at every step.',
  'Assalamu alaikum. Before anything else, we want you to know: your safety matters more to us than any match, any feature, any number. This platform only works if you feel protected using it. So here is our honest guidance — the same advice we give our own family.

Take your time. There is no rush.
Anyone genuinely seeking marriage will respect a careful pace. Someone who pressures you to move fast — to share your number, to meet immediately, to send photos — is showing you who they are. Believe them, and step back.

Keep conversations on Kulmi at the start.
Our chats are private, your wali can have oversight, and screenshots are blocked in the app. The moment a conversation moves to another app, those protections are gone. There is a reason someone might push to leave quickly — and it is rarely a good one.

Never send money. Ever.
No matter how touching the story is — a stuck visa, a sick relative, a business emergency — a person you met online asking you for money is the oldest scam in the book. It preys especially on our community''s generosity. If anyone asks, stop, report them from the chat, and let us handle it. You will never be judged for reporting.

Guard your personal details.
Your first name, your values, your hopes — share freely. Your home address, workplace address, financial details, passport or ID — never. A serious person does not need any of that before nikah discussions involve families.

When you meet, meet properly.
Meet in a public place, tell someone you trust, and honestly — bring your wali or a family member. This is not old-fashioned; it is wise, it is our deen, and it instantly filters out anyone whose intentions are not serious. A person with pure intentions will be pleased to meet your family. A person who resists it has told you everything.

Trust that feeling.
If something feels off — inconsistent stories, avoiding voice or video, anger when you ask normal questions — do not talk yourself out of your instinct. Use the report button, use "end and stop contact", and walk away in peace. Every report comes to a real person on our team, and we act on them.

We built verification, private photos, wali oversight and screenshot-blocking into Kulmi because trust is not a feature — it is the whole point. Use these tools. They are yours.

May Allah protect you and grant you a righteous spouse through halal means.
— Suhayb & Fardowza, Kulmi',
  true
),
(
  'a0000000-0000-4000-8000-000000000002',
  'How do you know they''re right for you? The questions that actually matter',
  'Beauty fades and butterflies settle. Here''s what to actually look for in a spouse — from the sunnah, from our elders, and from what we''ve seen work.',
  'Assalamu alaikum. Everyone will tell you what they think you should want in a spouse. Tall. From a good family. Finished university. Masha''Allah to all of it — but none of it is what keeps a marriage standing at year ten.

The Prophet ﷺ told us plainly: a person is married for four things — wealth, lineage, beauty, and deen — "so choose the one with deen, may your hands be covered in dust." That hadith is not asking you to ignore everything else. It is telling you what to weigh heaviest when things compete.

So what does "choosing deen" actually look like in a conversation?

1. How do they treat people they don''t need?
Watch how they speak about waiters, relatives they dislike, people they disagree with. Character under no pressure is a preview of character under pressure — and marriage is pressure.

2. What do they do when they''re wrong?
Ask about a time they made a mistake. Someone who can say "I was wrong, and here''s what I learned" will be able to say it to you at midnight in year three. Someone who has never been wrong will make you pay for every disagreement.

3. Do your five-year pictures fit together?
Where do you each want to live? How many children, and raised how? Whose career bends when they clash? What role will parents and in-laws play? These are not romantic questions — that is exactly why they matter. This is why our compatibility session asks them before you ever chat.

4. How do they handle anger?
Everyone is lovely when happy. Ask — gently — what they are like when they are upset. Then watch for it: how do they respond the first time you disagree with them? That first disagreement is a gift. Pay attention to it.

5. Can you be boring together?
The butterflies settle for everyone. What remains is Tuesday evenings, school runs, tea after Fajr. Ask yourself honestly: is this someone I could be unremarkable with, in peace?

And one thing NOT to look for: perfection. You are not perfect; neither are they; neither were our parents. You are not choosing a finished person — you are choosing someone whose direction you trust and whose character you respect enough to grow beside.

Make istikhara. Involve your family. Take your time. And trust that what Allah has written for you will not miss you.
— Suhayb & Fardowza, Kulmi',
  true
),
(
  'a0000000-0000-4000-8000-000000000003',
  'From salaam to nikah: a gentle roadmap',
  'What actually happens between the first message and the wedding? A practical, halal step-by-step for the road ahead.',
  'Assalamu alaikum. One question we hear again and again, especially from those who grew up in the diaspora: "Okay… I''ve matched with someone serious. Now what?" Nobody hands us a map. So here is one — practical, halal, and unhurried.

Step 1: The first conversations (weeks, not months)
Keep it purposeful. You are not building a texting habit; you are finding out whether this person''s deen, character and direction fit yours. Talk about real things early — our compatibility questions exist precisely so the serious topics are already on the table. If weeks pass and the conversation stays surface-level, ask yourself why.

Step 2: Voices and faces
Words on a screen hide a lot. When there is genuine mutual interest, a voice or video conversation — with adab, and ideally with family aware — tells you more in twenty minutes than a month of typing. Someone who refuses ever to be seen or heard is a red flag, full stop.

Step 3: Involve the families early — not late
In our culture and our deen, marriage is between families, not just two people. Telling your wali or parents early is not losing independence; it is gaining protection, wisdom, and seriousness. On Kulmi you can give your wali read-only oversight from day one. Use it. A person who resists ever meeting your family is not confused — they are telling you their intentions.

Step 4: The families meet
Whether it is a formal doonis or a relaxed meeting over tea, this step changes everything: it makes the intention public, it lets people who love you assess with clear eyes, and it honours both families. Prepare for it like it matters — because it does.

Step 5: Istikhara — and an honest answer
Pray istikhara sincerely, then pay attention to how things unfold — ease or obstacles, comfort or persistent unease. Istikhara is not a dream or a sign in the clouds; it is asking Allah to open the good path and close the harmful one. Trust what He shows you, even when it is not what you hoped.

Step 6: Meher, nikah, and keeping it light
Keep the meher and the wedding within everyone''s means. The most blessed marriage, our Prophet ﷺ taught, is the one easiest in expense. A marriage that starts buried in wedding debt starts with a weight it did not need.

There is no prize for speed and no shame in a road that takes months. Move with intention, involve those who love you, and let every step be one you can stand behind.

May Allah write for you a home of tranquility, love and mercy.
— Suhayb & Fardowza, Kulmi',
  true
),
(
  'a0000000-0000-4000-8000-000000000004',
  'Green flags, red flags: what to notice in the first conversations',
  'Some signs whisper and some shout. What to watch for — good and bad — when you''re getting to know someone for marriage.',
  'Assalamu alaikum. When you are hoping something works out, it is easy to explain away the things that bother you — and just as easy to overlook quiet good qualities that do not shout. So here is a plain list, from our hearts, of what to notice.

Green flags — the quiet good signs:

They ask about YOU. Real questions, and they remember your answers next week. Attention is the most honest form of interest.

Consistency. Who they are on Tuesday is who they are on Friday. Their stories line up. Their words and their behaviour match.

They speak well of others. Especially of their own family, and even of people who wronged them. A tongue that is gentle about others will one day be gentle about you.

They respect your boundaries the FIRST time. You say you are not comfortable sharing something yet, and they simply say "of course." No sulking, no pushing, no guilt.

They are happy to involve family. The wali conversation does not scare them — it relieves them. Serious people are drawn to seriousness.

They talk about "we" realistically. Not fairy tales — actual pictures: where to live, how to handle money, how to raise children. Dreaming with their feet on the ground.

Red flags — believe them the first time:

Pressure. To move faster, to leave the app, to share photos, to keep the relationship secret. Sincerity is patient; pressure has a reason.

Anger at normal questions. You ask about work, family, or plans — and get defensiveness or offence. Questions only threaten someone with something to hide.

Everyone else is the problem. Every ex was crazy, every fallout was the other person''s fault. One day that story will be about you.

Hot and cold. Intense attention, then disappearance, then love again. That is not mystery; that is instability — exhausting in courtship and corrosive in marriage.

Money talk. Any request for money, "investment tips", or sad emergencies that only you can solve. End the conversation and report it — you will be protecting others too.

Mocking your deen or your standards. If they belittle your prayer, your hijab, your boundaries, or your family''s involvement now — while trying to impress you — imagine after the walima.

One bad sign in a good person is a conversation to have. A pattern is an answer. May Allah give you eyes that see clearly and a heart at peace with what they see.
— Suhayb & Fardowza, Kulmi',
  true
),
(
  'a0000000-0000-4000-8000-000000000005',
  'Why involve your wali? Deen, dhaqan, and dignity',
  'Family involvement isn''t a restriction — it''s a protection and an honour. What the wali''s role really is, and how it works on Kulmi.',
  'Assalamu alaikum. For some of us who grew up in the West, "my family will be involved in my marriage search" can sound like a loss of freedom. We want to gently offer another lens — because in our deen and our dhaqan, the wali is not a gatekeeper against you. He is a shield around you.

What the wali actually is
In Islam, the wali — a father, uncle, brother, or trusted elder — represents your interests in the most consequential decision of your life. Not to overrule your heart, but to see what your heart, mid-hope, might miss. The Prophet ﷺ connected marriage to the wali not to restrict women, but to guarantee that no woman ever stands alone in front of a man and his promises.

Protection from the practical things
An experienced elder asks the unromantic questions: How exactly does he earn? What are his obligations back home? What happened in his previous marriage? These questions are awkward for you to ask — and effortless for your wali. That is the division of labour: you assess the heart, he assesses the ground it stands on.

Seriousness, instantly filtered
Here is the quiet magic: the moment family is involved, unserious people leave. A man asked to speak to a father either steps forward or vanishes — and both answers are gifts. Whole months of wasted conversation, avoided in one step.

And for the brothers
Involving your family early is your protection too — and your credential. Meeting her wali with respect and transparency says more about your intentions than a thousand messages. It is also how our fathers and grandfathers did it: openly, with nothing to hide.

How it works on Kulmi
You can invite your wali by email from Settings. He confirms from his own inbox, and gets read-only oversight of your conversations — he can see, but never write as you, and he is never involved without your knowledge. It is transparency you control, honouring both your independence and your family''s place.

If family is complicated
We know it is not simple for everyone. Some have lost their father; some have difficult family situations. The deen has answers — another male relative, or an imam, can stand as wali. If this is your situation, speak to a scholar you trust. You are not less deserving of protection; the community stands in where family cannot.

Isla Kulma, Isla Noolada — come together, live together. Marriage in our tradition has never been two people alone; it is two families weaving together. Let those who love you walk this road with you.
— Suhayb & Fardowza, Kulmi',
  true
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
