/**
 * `express_reaction` — an entertainment tool that lets the model tap one emoji onto the user's
 * message instead of answering with words. The tool itself is side-effect free: it validates the
 * reaction name, trims the optional comment, and echoes both back. The Client half renders the
 * call as a reaction stamp above the user's bubble (a `conversation.chat.user.before` decoration)
 * and hides the tool row, so the reaction reads as a tapback rather than a machine step.
 *
 * The eight built-in emoji, the user's own reactions, and the stamp size are `Config` fields,
 * declared `.volatile()` so the Settings form can change them live. The resolved pair rides to the
 * Client through the tool result's presentation meta — a configured emoji never appears in the call
 * arguments, so the result meta is the only channel that carries it to the stamp. Custom reaction
 * names cannot ride the tool schema (it is registered once), so a prompt section reports the live
 * list to the model on every assembly.
 * @module dsh-emoji-reaction
 */
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';

/** Canonical built-in reaction name → default emoji. Config fields override the emoji, never the names. */
const DEFAULT_EMOJI = {
  like: '👍',
  dislike: '👎',
  excited: '🤩',
  frustrated: '😔',
  confused: '🤔',
  speechless: '😑',
  surprised: '😲',
  sleepy: '🥱',
};

const REACTIONS = Object.keys(DEFAULT_EMOJI);

/** Longest comment kept in the stamp; longer text is truncated rather than rejected. */
const MAX_COMMENT_LENGTH = 50;

/** Stamp text size in pixels; the emoji renders one pixel larger. */
const DEFAULT_SIZE = 11;
const MIN_SIZE = 8;
const MAX_SIZE = 20;

/** The Config field that carries the user's own reaction list. */
const CUSTOM_FIELD = 'customReactions';

/** Where the prompt note about reaction names sits, between the tool sections and the SDK block. */
const PROMPT_ORDER = 2950;

/** The Config field that carries one reaction's emoji, e.g. `like` → `emojiLike`. */
function emojiField(reaction) {
  return `emoji${reaction[0].toUpperCase()}${reaction.slice(1)}`;
}

const CONFIG_FIELDS = {
  emojiLike: 'The emoji for `like`, shown when the message earns approval.',
  emojiDislike: 'The emoji for `dislike`, shown for a bad idea.',
  emojiExcited: 'The emoji for `excited`, shown for a fun or ambitious idea.',
  emojiFrustrated: 'The emoji for `frustrated`, shown when the same problem comes back.',
  emojiConfused: 'The emoji for `confused`, shown for a request that contradicts itself.',
  emojiSpeechless: 'The emoji for `speechless`, shown when there is nothing to say.',
  emojiSurprised: 'The emoji for `surprised`, shown for something unexpected.',
  emojiSleepy: 'The emoji for `sleepy`, shown for a tedious request.',
  customReactions: 'Reactions you add yourself: a name the model can call and the emoji it stamps.',
  size: 'Stamp text size in pixels (8–20). The emoji renders one pixel larger.',
};

/** One user-defined reaction as the Settings form stores it. */
const CustomReaction = z.object({
  name: z.string().description('The name the model calls, e.g. 大肥鱼.'),
  emoji: z.string().description('The emoji stamped next to the words, e.g. 🐟.'),
});

/** Live, editable fields: the Settings form writes them and the next call reads the new value. */
export const Config = z.object({
  emojiLike: z.string().description(CONFIG_FIELDS.emojiLike).default(DEFAULT_EMOJI.like).volatile(),
  emojiDislike: z.string().description(CONFIG_FIELDS.emojiDislike).default(DEFAULT_EMOJI.dislike).volatile(),
  emojiExcited: z.string().description(CONFIG_FIELDS.emojiExcited).default(DEFAULT_EMOJI.excited).volatile(),
  emojiFrustrated: z.string().description(CONFIG_FIELDS.emojiFrustrated).default(DEFAULT_EMOJI.frustrated).volatile(),
  emojiConfused: z.string().description(CONFIG_FIELDS.emojiConfused).default(DEFAULT_EMOJI.confused).volatile(),
  emojiSpeechless: z.string().description(CONFIG_FIELDS.emojiSpeechless).default(DEFAULT_EMOJI.speechless).volatile(),
  emojiSurprised: z.string().description(CONFIG_FIELDS.emojiSurprised).default(DEFAULT_EMOJI.surprised).volatile(),
  emojiSleepy: z.string().description(CONFIG_FIELDS.emojiSleepy).default(DEFAULT_EMOJI.sleepy).volatile(),
  customReactions: z.array(CustomReaction).description(CONFIG_FIELDS.customReactions).default([]).volatile(),
  size: z.number().description(CONFIG_FIELDS.size).default(DEFAULT_SIZE).volatile(),
});

const DESCRIPTION = [
  "React to the user's latest message with one emoji, the way a person taps a reaction instead of typing a reply.",
  'This is decoration, never an answer: it does not replace the work the message asks for.',
  'Most messages deserve no reaction at all. Reach for it when the message itself is the event — a joke that lands, an absurd or over-the-top request, a premise that is wrong in a funny way, an idea that is genuinely delightful, or a question repeated after you already answered it.',
  'Skip it for ordinary work: writing code, fixing an error, looking something up, or any direct request to do something. Do the work and leave the reaction alone.',
].join(' ');

/**
 * Unwrap the live references `.volatile()` hands `apply`, so every read sees the value the
 * Settings form last accepted rather than the reference object itself.
 * @param config - the plugin config as composed by the Loader.
 * @returns a plain object of current values.
 */
function readConfig(config) {
  const values = {};
  if (config === null || typeof config !== 'object') return values;
  for (const [key, value] of Object.entries(config)) {
    values[key] = value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value;
  }
  return values;
}

/**
 * The built-in emoji table and the user's own reactions as currently configured.
 * @param config - the plugin config.
 * @returns `{ builtin: { name: emoji }, custom: [{ name, emoji }] }`.
 */
function reactionTable(config) {
  const values = readConfig(config);

  const builtin = {};
  for (const reaction of REACTIONS) {
    const value = values[emojiField(reaction)];
    builtin[reaction] = typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_EMOJI[reaction];
  }

  const custom = [];
  const seen = new Set(REACTIONS);
  const configured = values[CUSTOM_FIELD];
  if (Array.isArray(configured)) {
    for (const entry of configured) {
      if (entry === null || typeof entry !== 'object') continue;
      const name = typeof entry.name === 'string' ? entry.name.trim() : '';
      const emoji = typeof entry.emoji === 'string' ? entry.emoji.trim() : '';
      if (name === '' || emoji === '') continue;
      const key = name.toLowerCase();
      // A custom name that collides with a built-in one would shadow it invisibly; skip it here and
      // let the Settings form report the collision instead.
      if (seen.has(key)) continue;
      seen.add(key);
      custom.push({ name, emoji });
    }
  }

  return { builtin, custom };
}

/**
 * Resolve one reaction name. Built-in names match case-insensitively; custom names match
 * case-insensitively too but keep the spelling the user configured.
 * @param config - the plugin config.
 * @param raw - the name the model sent.
 * @returns `{ name, emoji, custom }`, or null when the name is unknown.
 */
function resolveReaction(config, raw) {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name === '') return null;
  const lowered = name.toLowerCase();
  const table = reactionTable(config);
  for (const [key, emoji] of Object.entries(table.builtin)) {
    if (key.toLowerCase() === lowered) return { name: key, emoji, custom: false };
  }
  for (const entry of table.custom) {
    if (entry.name.toLowerCase() === lowered) return { name: entry.name, emoji: entry.emoji, custom: true };
  }
  return null;
}

/** Every name `express_reaction` currently accepts, for error messages and the prompt note. */
function reactionNames(config) {
  const table = reactionTable(config);
  return [...Object.keys(table.builtin), ...table.custom.map((entry) => entry.name)];
}

/**
 * The prompt note that keeps the model's view of the reaction names live: a function text runs on
 * every assembly, so a reaction added in Settings is callable on the next step without a reload.
 * @param config - the plugin config.
 * @returns the section text.
 */
function promptText(config) {
  const table = reactionTable(config);
  const builtin = Object.entries(table.builtin)
    .map(([name, emoji]) => `${name} ${emoji}`)
    .join(', ');
  const parts = [`\`express_reaction\` accepts these reaction names: ${builtin}.`];
  if (table.custom.length > 0) {
    const custom = table.custom.map((entry) => `${entry.name} ${entry.emoji}`).join(', ');
    parts.push(`The user also defined custom reactions: ${custom}.`);
  }
  return parts.join(' ');
}

/**
 * The configured stamp size, clamped to what a stamp can legibly render as.
 * @param config - the plugin config.
 * @returns a whole number of pixels.
 */
function stampSize(config) {
  const value = readConfig(config).size;
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, number));
}

/** Trim and collapse the model's aside; a reaction never carries an essay. */
function normalizeComment(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_COMMENT_LENGTH);
}

/**
 * Register the prompt note and the `express_reaction` tool.
 * @param ctx - registrant context carrying the tool and prompt registries.
 * @param config - the plugin config (live references).
 */
export function apply(ctx, config) {
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'emoji-reaction',
        order: PROMPT_ORDER,
        text: () => promptText(config),
      }),
    'emoji-reaction: prompt note',
  );

  ctx.effect(
    () =>
      ctx.tools.register(
        defineTool({
          name: 'express_reaction',
          description: DESCRIPTION,
          parameters: {
            reaction: {
              type: 'string',
              required: true,
              description:
                'The reaction name: one of the built-in emotions (`like` 👍 approval, `dislike` 👎 a bad idea, `excited` 🤩 delighted by a fun or ambitious idea, `frustrated` 😔 the same problem coming back, `confused` 🤔 a request that contradicts itself, `speechless` 😑 nothing to say, `surprised` 😲 you did not expect that, `sleepy` 🥱 tedious), or a custom reaction name the user defined, which the prompt lists with its emoji.',
            },
            comment: {
              type: 'string',
              description:
                "An optional aside shown next to the emoji, in the user's language, at most 50 characters: a quip or a nudge, not an explanation or a summary. Omit it when the emoji already says everything.",
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                reaction: { type: 'string', required: true },
                emoji: { type: 'string', required: true },
                comment: { type: 'string', required: true },
              },
            },
            render: (_args, value) => [
              {
                type: 'text',
                text: `Reacted ${value.emoji}${value.comment === '' ? '' : ` — ${value.comment}`}.`,
              },
            ],
            // The browser half renders from these values: a configured emoji never appears in the
            // call arguments, so the result meta is the only channel that carries it to the stamp.
            presentationMeta: (_args, value) => ({
              reaction: value.reaction,
              emoji: value.emoji,
              size: stampSize(config),
            }),
          },
          execute(args) {
            const resolved = resolveReaction(config, args?.reaction);
            if (resolved === null) {
              const raw = typeof args?.reaction === 'string' ? args.reaction.trim() : '';
              return Promise.reject(
                new Error(`unknown reaction "${raw}"; valid values: ${reactionNames(config).join(', ')}`),
              );
            }
            return Promise.resolve({
              reaction: resolved.name,
              emoji: resolved.emoji,
              comment: normalizeComment(args?.comment),
            });
          },
          isConcurrencySafe: () => true,
          presentCall: (args) => {
            const resolved = resolveReaction(config, args?.reaction);
            return {
              card: 'generic',
              title: `${resolved?.emoji ?? ''} ${resolved?.name ?? args?.reaction ?? 'reaction'}`.trim(),
              kind: 'other',
              rawInput: args,
            };
          },
        }),
      ),
    'emoji-reaction: express_reaction tool',
  );
}

export const name = 'emoji-reaction';
export const inject = ['tools', 'systemPrompt'];