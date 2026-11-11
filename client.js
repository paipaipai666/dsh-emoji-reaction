/**
 * Client half of the emoji reaction plugin.
 *
 * Two surfaces: the keyed `tool.call.toolview` row, claimed only to keep the reaction out of the
 * collapsed process details, and the `conversation.chat.user.before` chain decoration, which stamps
 * every reaction of a Turn onto the user message bubble that owns it.
 *
 * The decoration receives only the durable message `source`, so it locates its own Chat node by
 * matching `source.rpcId` inside the Chat snapshot, then collects the `express_reaction` calls that
 * ran in that node's Turn — in order, so several reactions stack as a row of stamps. Everything
 * stays derived: no client store, no session writes. The configured emoji and size arrive on the
 * tool result's `presentationMeta`, so a value the user changed in Settings still renders here.
 *
 * The same `ReactionForm` backs two setting surfaces: the bundle row page and the Settings section.
 * Both read and write the Host's settings document through the `configForms` controller, so the
 * Host stays the only source of truth.
 */
window.__ModuleLoader__.load({
  id: 'dsh-emoji-reaction',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace for this plugin's Client strings. */
    const NS = 'emoji-reaction';

    /** Host tool name; also the keyed toolview key. */
    const TOOL_NAME = 'express_reaction';

    /** Reaction name → shipped emoji. The result meta overrides this when the Host is configured. */
    const EMOJI = {
      like: '👍',
      dislike: '👎',
      excited: '🤩',
      frustrated: '😔',
      confused: '🤔',
      speechless: '😑',
      surprised: '😲',
      sleepy: '🥱',
    };

    const LABELS = {
      en: {
        nav: 'Emoji reaction',
        'state.unknown': 'No reaction',
        'reaction.like': 'Like',
        'reaction.dislike': 'Not a fan',
        'reaction.excited': 'Excited',
        'reaction.frustrated': 'Frustrated',
        'reaction.confused': 'Confused',
        'reaction.speechless': 'Speechless',
        'reaction.surprised': 'Surprised',
        'reaction.sleepy': 'Sleepy',
        'config.summary': 'Reaction emoji, your own reactions, and the stamp size.',
        'config.title': 'Reaction stamps',
        'config.hint': 'Pick an emoji, add your own reactions, then save. Changes apply from the next reaction on.',
        'config.loading': 'Reading the served values…',
        'config.reactions': 'Reactions',
        'config.reactionsHint': 'Click one to change its emoji',
        'config.pick': 'Choose an emoji',
        'config.typedEmoji': 'or paste any emoji',
        'config.done': 'Done',
        'config.custom': 'Your own reactions',
        'config.customHint': 'A name the model can call plus the emoji it stamps — e.g. 大肥鱼 🐟.',
        'config.add': 'Add reaction',
        'config.empty': 'None yet. Add one when a built-in emoji no longer fits.',
        'config.namePlaceholder': 'name, e.g. 大肥鱼',
        'config.remove': 'Remove',
        'config.size': 'Stamp size',
        'config.preview': 'Preview',
        'config.previewComment': 'This size looks about right',
        'config.save': 'Save',
        'config.saving': 'Saving…',
        'config.saved': 'Saved.',
        'config.failed': 'Save failed.',
        'config.badRow': 'Every custom reaction needs a name and an emoji, and its name must not repeat a built-in one.',
        'config.reset': 'Restore defaults',
      },
      zh: {
        nav: '表情回应',
        'state.unknown': '没有反应',
        'reaction.like': '点赞',
        'reaction.dislike': '不敢苟同',
        'reaction.excited': '兴奋',
        'reaction.frustrated': '心累',
        'reaction.confused': '困惑',
        'reaction.speechless': '无语',
        'reaction.surprised': '没想到',
        'reaction.sleepy': '乏了',
        'config.summary': '表情、自定义反应与字号。',
        'config.title': '表情回应',
        'config.hint': '点一下换 emoji，也能加自己的反应；保存后从下一次回应起生效。',
        'config.loading': '正在读取已生效的值…',
        'config.reactions': '反应',
        'config.reactionsHint': '点一下就能换 emoji',
        'config.pick': '选一个 emoji',
        'config.typedEmoji': '或者直接粘贴 emoji',
        'config.done': '完成',
        'config.custom': '自定义反应',
        'config.customHint': '起一个模型能用的名字，配一个 emoji，比如「大肥鱼」🐟。',
        'config.add': '添加反应',
        'config.empty': '还没有自定义反应；内置的不够用时再加一个。',
        'config.namePlaceholder': '名字，比如 大肥鱼',
        'config.remove': '删除',
        'config.size': '字号',
        'config.preview': '预览',
        'config.previewComment': '这个字号看着还行',
        'config.save': '保存',
        'config.saving': '保存中…',
        'config.saved': '已保存。',
        'config.failed': '保存失败。',
        'config.badRow': '每个自定义反应都要有名字和 emoji，名字不能和内置反应重复。',
        'config.reset': '恢复默认',
      },
      ja: {
        nav: '絵文字リアクション',
        'state.unknown': '反応なし',
        'reaction.like': 'いいね',
        'reaction.dislike': '微妙',
        'reaction.excited': 'わくわく',
        'reaction.frustrated': 'お疲れ',
        'reaction.confused': '困惑',
        'reaction.speechless': '無言',
        'reaction.surprised': '意外',
        'reaction.sleepy': '眠い',
        'config.summary': 'リアクションと文字サイズ。',
        'config.title': 'リアクションスタンプ',
        'config.hint': '絵文字を選び、独自のリアクションも追加できます。保存すると次のリアクションから反映されます。',
        'config.loading': '反映中の値を読み込み中…',
        'config.reactions': 'リアクション',
        'config.reactionsHint': 'クリックで絵文字を変更',
        'config.pick': '絵文字を選ぶ',
        'config.typedEmoji': 'または絵文字を貼り付け',
        'config.done': '完了',
        'config.custom': '独自のリアクション',
        'config.customHint': 'モデルが呼ぶ名前と、押される絵文字の組み合わせ。例: 大肥魚 🐟',
        'config.add': 'リアクションを追加',
        'config.empty': 'まだありません。組み込みの絵文字で足りないときに追加してください。',
        'config.namePlaceholder': '名前（例: 大肥魚）',
        'config.remove': '削除',
        'config.size': 'サイズ',
        'config.preview': 'プレビュー',
        'config.previewComment': 'このサイズでよさそう',
        'config.save': '保存',
        'config.saving': '保存中…',
        'config.saved': '保存しました。',
        'config.failed': '保存に失敗しました。',
        'config.badRow': '独自のリアクションには名前と絵文字が必要です。名前は組み込みと重複できません。',
        'config.reset': '既定値に戻す',
      },
      ko: {
        'state.unknown': '반응 없음',
        'reaction.like': '좋아요',
        'reaction.dislike': '별로',
        'reaction.excited': '신남',
        'reaction.frustrated': '지침',
        'reaction.confused': '혼란',
        'reaction.speechless': '할 말 없음',
        'reaction.surprised': '의외',
        'reaction.sleepy': '졸림',
      },
      fr: {
        'state.unknown': 'Aucune réaction',
        'reaction.like': "J'aime",
        'reaction.dislike': 'Pas fan',
        'reaction.excited': 'Enthousiaste',
        'reaction.frustrated': 'Las',
        'reaction.confused': 'Perplexe',
        'reaction.speechless': 'Sans voix',
        'reaction.surprised': 'Surpris',
        'reaction.sleepy': 'Fatigué',
      },
      es: {
        'state.unknown': 'Sin reacción',
        'reaction.like': 'Me gusta',
        'reaction.dislike': 'No me convence',
        'reaction.excited': 'Emocionado',
        'reaction.frustrated': 'Cansado',
        'reaction.confused': 'Confundido',
        'reaction.speechless': 'Sin palabras',
        'reaction.surprised': 'Sorprendido',
        'reaction.sleepy': 'Somnoliento',
      },
      de: {
        'state.unknown': 'Keine Reaktion',
        'reaction.like': 'Gefällt mir',
        'reaction.dislike': 'Nicht überzeugt',
        'reaction.excited': 'Begeistert',
        'reaction.frustrated': 'Genervt',
        'reaction.confused': 'Verwirrt',
        'reaction.speechless': 'Sprachlos',
        'reaction.surprised': 'Überrascht',
        'reaction.sleepy': 'Müde',
      },
      ru: {
        'state.unknown': 'Без реакции',
        'reaction.like': 'Нравится',
        'reaction.dislike': 'Не то',
        'reaction.excited': 'Воодушевлён',
        'reaction.frustrated': 'Устал',
        'reaction.confused': 'В недоумении',
        'reaction.speechless': 'Без слов',
        'reaction.surprised': 'Удивлён',
        'reaction.sleepy': 'Сонный',
      },
      pt: {
        'state.unknown': 'Sem reação',
        'reaction.like': 'Curti',
        'reaction.dislike': 'Não curti',
        'reaction.excited': 'Empolgado',
        'reaction.frustrated': 'Cansado',
        'reaction.confused': 'Confuso',
        'reaction.speechless': 'Sem palavras',
        'reaction.surprised': 'Surpreso',
        'reaction.sleepy': 'Sonolento',
      },
    };

    const EN = LABELS.en;

    /** Shipped stamp size, matching the Host default; the result meta carries any override. */
    const DEFAULT_SIZE = 11;
    const MIN_SIZE = 8;
    const MAX_SIZE = 20;

    /** The bundle's package name and the row id its patch declares, joined as a `plugins.row.config` key. */
    const PACKAGE_NAME = 'dsh-emoji-reaction';
    const ROW_ID = 'emoji-reaction';

    /** Host Config field per built-in reaction, in the order the settings page lists them. */
    const CONFIG_ROWS = [
      ['like', 'emojiLike'],
      ['dislike', 'emojiDislike'],
      ['excited', 'emojiExcited'],
      ['frustrated', 'emojiFrustrated'],
      ['confused', 'emojiConfused'],
      ['speechless', 'emojiSpeechless'],
      ['surprised', 'emojiSurprised'],
      ['sleepy', 'emojiSleepy'],
    ];

    /** The Host Config field that holds the user's own reactions. */
    const CUSTOM_FIELD = 'customReactions';

    /** The palette offered under a reaction: common faces first, then a few expressive ones. */
    const PALETTE = [
      '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤪', '🤨', '🧐',
      '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
      '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵',
      '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
      '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤',
      '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '👍', '👎', '👏', '🙌',
      '🤝', '👀', '🔥', '💯', '✨', '🎉', '🚀', '🐟', '🧠', '💡', '⚡', '🌚',
    ];

    /** A row of the user's own reaction list, keyed for React while the page is open. */
    let rowCounter = 0;
    function nextRowId() {
      rowCounter += 1;
      return `custom-${rowCounter}`;
    }

    /** The stamp row: right-aligned with the bubble, wrapping when a Turn earned several stamps. */
    const BUBBLE_ROW = {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: '6px',
      minWidth: '0',
      maxWidth: '100%',
      margin: '0 0 2px',
    };

    const BUBBLE_PILL = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      maxWidth: '100%',
      minWidth: '0',
      padding: '0 2px',
      color: 'var(--dsw-alias-label-tertiary)',
    };

    const CLIPPED = {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: '0',
    };

    /** The reaction name translated through the Client locale seat, with an English fallback. */
    function reactionLabel(t, reaction) {
      const key = `reaction.${reaction}`;
      if (typeof t === 'function') {
        const text = t(key);
        if (typeof text === 'string' && text !== '' && text !== key) return text;
      }
      return EN[key] ?? reaction;
    }

    /** The placeholder shown when a call arrives without a readable reaction. */
    function unknownLabel(t) {
      if (typeof t === 'function') {
        const text = t('state.unknown');
        if (typeof text === 'string' && text !== '' && text !== 'state.unknown') return text;
      }
      return EN['state.unknown'];
    }

    function parseArguments(raw) {
      if (typeof raw !== 'string' || raw === '') return null;
      try {
        const value = JSON.parse(raw);
        return value !== null && typeof value === 'object' ? value : null;
      } catch {
        return null;
      }
    }

    /**
     * Recover the call arguments from whichever phase block is at hand: a settled call carries
     * them under `block.call`, a running one under the block itself, and either may still be a
     * lazy `PartialArguments` view.
     * @param block - toolview phase block or Chat tool Node payload.
     * @returns the parsed arguments, or null when they are absent or incomplete.
     */
    function callArguments(block) {
      if (block === null || typeof block !== 'object') return null;
      const call = block.call !== null && typeof block.call === 'object' ? block.call : null;
      const raw = (call !== null && call.argsRaw) || block.argsRaw;
      const settled = parseArguments(raw);
      if (settled !== null) return settled;
      const lazy = block.args;
      if (lazy === null || typeof lazy !== 'object') return null;
      if (lazy.object !== null && typeof lazy.object === 'object') return lazy.object;
      if (Array.isArray(lazy.chunks) && lazy.chunks.length > 0) return parseArguments(lazy.chunks.join(''));
      return null;
    }

    /** The result Node carries the Host's `presentationMeta` under `root.meta`. */
    function rootMeta(root) {
      const meta = root !== null && typeof root === 'object' ? root.meta : null;
      return meta !== null && typeof meta === 'object' ? meta : null;
    }

    /** Clamp the configured stamp size to something a stamp can legibly render as. */
    function clampSize(value) {
      const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_SIZE;
      return Math.min(MAX_SIZE, Math.max(MIN_SIZE, number));
    }

    /** Clamp the size carried by a result document. */
    function stampSize(meta) {
      return clampSize(meta !== null && typeof meta.size === 'number' ? meta.size : DEFAULT_SIZE);
    }

    /**
     * Normalise one parsed argument object into what one stamp renders. A custom reaction has no
     * translation, so its configured name is its label; the Host's meta is what tells this half
     * that the call was valid at all.
     */
    function readReaction(args, t, meta) {
      const raw = args !== null && typeof args.reaction === 'string' ? args.reaction.trim() : '';
      const name = raw.toLowerCase();
      const builtin = Object.prototype.hasOwnProperty.call(EMOJI, name);
      const configured = meta !== null && typeof meta.emoji === 'string' ? meta.emoji.trim() : '';
      const known = builtin || configured !== '';
      const comment =
        args !== null && typeof args.comment === 'string' ? args.comment.replace(/\s+/g, ' ').trim() : '';
      const label = builtin ? reactionLabel(t, name) : raw !== '' ? raw : unknownLabel(t);
      const emoji = known ? (configured !== '' ? configured : EMOJI[name]) : '🤷';
      return {
        name,
        known,
        emoji,
        label,
        comment,
        text: known && comment !== '' ? comment : label,
        size: stampSize(meta),
      };
    }

    /**
     * The reaction renders on the user bubble instead. Claiming the keyed Tool view (rather than
     * leaving it unclaimed) also suppresses the generic row, so the process details stay quiet.
     * @returns nothing.
     */
    function HiddenToolRow() {
      return null;
    }

    /** The Chat snapshot exposes `nodes.values()`; be defensive about older shapes. */
    function nodeValues(nodeStore) {
      if (nodeStore === null || typeof nodeStore !== 'object' || typeof nodeStore.values !== 'function') return [];
      const values = nodeStore.values();
      return Array.isArray(values) ? values : [];
    }

    /** Two durable message sources describe the same message: `rpcId` is the only stable handle. */
    function sameSource(left, right) {
      if (left === right) return true;
      if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
      return typeof left.rpcId === 'string' && left.rpcId !== '' && left.rpcId === right.rpcId;
    }

    /** The tool-call Node carries its call payload at `data.root`. */
    function callRoot(node) {
      const data = node !== null && typeof node === 'object' ? node.data : null;
      const root = data !== null && typeof data === 'object' ? data.root : null;
      return root !== null && typeof root === 'object' ? root : null;
    }

    function callName(root) {
      if (typeof root.name === 'string') return root.name;
      const call = root.call !== null && typeof root.call === 'object' ? root.call : null;
      return call !== null && typeof call.name === 'string' ? call.name : '';
    }

    /**
     * Collect the reactions that belong to one user message: its own Chat Node by `source.rpcId`,
     * then every `express_reaction` call in the same Turn (falling back to Node order), in order.
     * @param nodeStore - Chat snapshot node store.
     * @param source - durable message source handed to the decoration.
     * @returns the argument objects with their result meta and pending state.
     */
    function locateReactions(nodeStore, source) {
      const nodes = nodeValues(nodeStore);
      if (nodes.length === 0) return [];

      let message = null;
      let messageIndex = -1;
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (node === null || node.kind !== 'user') continue;
        const data = node.data !== null && typeof node.data === 'object' ? node.data : null;
        if (data !== null && sameSource(data.source, source)) {
          message = node;
          messageIndex = index;
          break;
        }
      }
      if (message === null) return [];

      const location = message.location !== null && typeof message.location === 'object' ? message.location : null;
      const turn = location !== null && typeof location.turn === 'number' ? location.turn : null;
      const anchor = typeof message.anchorSeq === 'number' ? message.anchorSeq : null;

      // A Turn ends where the next user message begins. Bounding the fallback this way keeps a
      // reaction from one Turn from being replayed on every earlier message that ever reacted.
      let nextAnchor = null;
      for (let index = messageIndex + 1; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (node === null || node.kind !== 'user') continue;
        if (typeof node.anchorSeq === 'number') {
          nextAnchor = node.anchorSeq;
          break;
        }
      }

      const hits = [];
      for (const node of nodes) {
        if (node === null || node.kind !== 'tool-call') continue;
        const root = callRoot(node);
        if (root === null || callName(root) !== TOOL_NAME) continue;

        const nodeLocation = node.location !== null && typeof node.location === 'object' ? node.location : null;
        const nodeTurn =
          nodeLocation !== null && typeof nodeLocation.turn === 'number'
            ? nodeLocation.turn
            : typeof root.turn === 'number'
              ? root.turn
              : null;

        const seq = typeof node.anchorSeq === 'number' ? node.anchorSeq : null;
        const inTurn = turn !== null && nodeTurn !== null && nodeTurn === turn;
        const inWindow = seq !== null && anchor !== null && seq > anchor && (nextAnchor === null || seq < nextAnchor);
        if (!inTurn && !inWindow) continue;

        const args = callArguments(root);
        if (args === null) continue;
        hits.push({ args, meta: rootMeta(root), pending: root.phase === 'start' });
      }
      return hits;
    }

    /** One stamp: the emoji beside its aside, or the reaction's name when it carries no words. */
    function ReactionStamp({ view }) {
      const style = {
        ...BUBBLE_PILL,
        fontSize: `${view.size}px`,
        lineHeight: `${view.size + 4}px`,
        opacity: view.pending ? '0.55' : '1',
      };
      return h(
        'span',
        {
          style,
          'data-emoji-reaction': view.name,
          title: `${view.emoji} ${view.label}`,
          role: 'img',
          'aria-label': view.comment === '' ? view.label : `${view.label}: ${view.comment}`,
        },
        h('span', { style: { fontSize: `${view.size + 1}px`, lineHeight: 1 }, 'aria-hidden': 'true' }, view.emoji),
        h('span', { style: CLIPPED }, view.text),
      );
    }

    /**
     * Chain decoration rendered directly above the user bubble. The selector claims every human
     * message; the component renders nothing unless that message's Turn carries a reaction.
     * @param props - chain payload: `matched` (the durable source) plus the standard Chat hooks.
     * @returns the reaction stamps, or nothing.
     */
    function UserReactionBubble(props) {
      const { matched, useChat, t } = props;
      const nodeStore = typeof useChat === 'function' ? useChat((snapshot) => snapshot.nodes) : null;
      let hits = [];
      try {
        hits = locateReactions(nodeStore, matched);
      } catch {
        hits = [];
      }
      if (hits.length === 0) return null;

      const views = hits.map((hit) => readReaction(hit.args, t, hit.meta));
      return h(
        'div',
        { style: BUBBLE_ROW },
        views.map((view, index) => h(ReactionStamp, { key: `${index}-${view.name}`, view })),
      );
    }

    // ── Settings page ────────────────────────────────────────────────────────────────────────────

    const PAGE = {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '680px',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: 'var(--dsw-font-xs-13)',
    };
    const HEADER = { display: 'flex', flexDirection: 'column', gap: '4px' };
    const TITLE = { margin: '0', fontSize: '15px', fontWeight: '600', color: 'var(--dsw-alias-label-primary)' };
    const HINT = { margin: '0', color: 'var(--dsw-alias-label-secondary)', lineHeight: '18px' };
    const CARD = {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px',
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-lg)',
    };
    const CARD_HEAD = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' };
    const CARD_TITLE = { margin: '0', fontSize: 'var(--dsw-font-xs-13)', fontWeight: '600' };
    const CARD_HINT = { margin: '0', color: 'var(--dsw-alias-label-tertiary)', lineHeight: '17px' };
    const CELL_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: '6px' };
    const CELL = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      padding: '8px 4px',
      font: 'inherit',
      color: 'var(--dsw-alias-label-secondary)',
      background: 'var(--dsw-alias-bg-base)',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const CELL_ON = { borderColor: 'var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-bg-layer-2)' };
    const CELL_EMOJI = { fontSize: '22px', lineHeight: 1 };
    const CELL_NAME = { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)' };
    const PALETTE_PANEL = {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '10px',
      background: 'var(--dsw-alias-bg-layer-2)',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-sm)',
    };
    const PALETTE_HEAD = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' };
    const PALETTE_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))', gap: '2px' };
    const PALETTE_CELL = {
      padding: '2px 0',
      font: 'inherit',
      fontSize: '17px',
      lineHeight: '22px',
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const PALETTE_ON = { borderColor: 'var(--dsw-alias-brand-primary)', background: 'var(--dsw-alias-bg-base)' };
    const ROW_LIST = { display: 'flex', flexDirection: 'column', gap: '6px' };
    const ROW = { display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) 28px', alignItems: 'center', gap: '6px' };
    const EMOJI_BUTTON = {
      width: '40px',
      height: '30px',
      padding: '0',
      font: 'inherit',
      fontSize: '17px',
      lineHeight: '26px',
      textAlign: 'center',
      background: 'var(--dsw-alias-bg-base)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const REMOVE_BUTTON = {
      width: '28px',
      height: '28px',
      padding: '0',
      font: 'inherit',
      fontSize: '15px',
      lineHeight: '24px',
      color: 'var(--dsw-alias-label-tertiary)',
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const INPUT = {
      width: '100%',
      minWidth: '0',
      boxSizing: 'border-box',
      padding: '4px 8px',
      font: 'inherit',
      fontSize: 'var(--dsw-font-xs-13)',
      lineHeight: '18px',
      color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-bg-base)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 'var(--dsw-radius-sm)',
    };
    const FIELD_LINE = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', color: 'var(--dsw-alias-label-secondary)' };
    const EMPTY = { margin: '0', color: 'var(--dsw-alias-label-tertiary)', fontStyle: 'italic' };
    const RANGE = { width: '100%', accentColor: 'var(--dsw-alias-brand-primary)' };
    const PREVIEW_BOX = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 12px',
      background: 'var(--dsw-alias-bg-base)',
      border: '1px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-sm)',
    };
    const PREVIEW_CAPTION = { color: 'var(--dsw-alias-label-tertiary)', fontSize: '11px', letterSpacing: '0.02em' };
    const ACTIONS = { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };
    const PRIMARY = {
      padding: '5px 16px',
      font: 'inherit',
      fontSize: 'var(--dsw-font-xs-13)',
      fontWeight: '500',
      color: '#fff',
      background: 'var(--dsw-alias-brand-primary)',
      border: '1px solid var(--dsw-alias-brand-primary)',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const SECONDARY = {
      padding: '5px 12px',
      font: 'inherit',
      fontSize: 'var(--dsw-font-xs-13)',
      color: 'var(--dsw-alias-label-secondary)',
      background: 'transparent',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const TERTIARY_BUTTON = {
      padding: '3px 10px',
      font: 'inherit',
      fontSize: 'var(--dsw-font-xs-13)',
      color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-bg-base)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 'var(--dsw-radius-sm)',
      cursor: 'pointer',
    };
    const NOTICE = { fontSize: 'var(--dsw-font-xs-13)', color: 'var(--dsw-alias-state-warn-primary)' };

    /** A settings string through the locale seat, with the English dictionary as the floor. */
    function configText(t, key) {
      if (typeof t === 'function') {
        const text = t(key);
        if (typeof text === 'string' && text !== '' && text !== key) return text;
      }
      return EN[key] ?? key;
    }

    /**
     * Build the editable draft from the served document. Missing or empty fields fall back to the
     * shipped defaults, which is also what `unset` means on the Host side.
     * @param values - the served section value, or null while it loads.
     * @returns `{ emoji, custom, size }` in the shape the form edits.
     */
    function draftFrom(values) {
      const source = values !== null && typeof values === 'object' ? values : {};

      const emoji = {};
      for (const [reaction, field] of CONFIG_ROWS) {
        const value = typeof source[field] === 'string' ? source[field].trim() : '';
        emoji[reaction] = value !== '' ? value : EMOJI[reaction];
      }

      const custom = [];
      const configured = source[CUSTOM_FIELD];
      if (Array.isArray(configured)) {
        for (const entry of configured) {
          if (entry === null || typeof entry !== 'object') continue;
          custom.push({
            id: nextRowId(),
            name: typeof entry.name === 'string' ? entry.name : '',
            emoji: typeof entry.emoji === 'string' ? entry.emoji : '',
          });
        }
      }

      return { emoji, custom, size: clampSize(source.size) };
    }

    /** The one-liner the Plugins page shows for this row. */
    function ReactionConfigSummary({ t }) {
      return h('span', null, configText(t, 'config.summary'));
    }

    /**
     * The settings form itself. Two owners render it — the Plugins row page and the Settings
     * section — and they differ only in where the served state and the write function come from;
     * the Host stays the fact source, and the draft re-seeds whenever the reported revision moves.
     * @param props - `state` (value, revision, writable), `mutate` (ops, revision), and the locale seat.
     * @returns the form, or the heading alone while no values are served yet.
     */
    function ReactionForm({ state, mutate, t }) {
      const served = state !== null && typeof state === 'object' ? state : null;
      const values = served !== null && served.value !== null && typeof served.value === 'object' ? served.value : null;
      const revision = served !== null && typeof served.revision === 'number' ? served.revision : null;
      const writable = served === null || served.writable !== false;

      const [draft, setDraft] = React.useState(() => draftFrom(values));
      const [picker, setPicker] = React.useState(null);
      const [typed, setTyped] = React.useState('');
      const [notice, setNotice] = React.useState(null);
      const [busy, setBusy] = React.useState(false);

      const seenRevision = React.useRef(revision);
      React.useEffect(() => {
        if (seenRevision.current === revision) return;
        seenRevision.current = revision;
        setDraft(draftFrom(values));
      }, [revision, values]);

      const disabled = busy || !writable;
      const clamped = clampSize(draft.size);

      const write = async (ops) => {
        if (busy || !writable || typeof mutate !== 'function') return;
        setBusy(true);
        setNotice(null);
        let ok = false;
        try {
          ok = await mutate(ops, revision);
        } catch {
          ok = false;
        }
        setBusy(false);
        setNotice(ok === true ? 'config.saved' : 'config.failed');
      };

      const setEmoji = (reaction, emoji) => {
        setDraft((current) => ({ ...current, emoji: { ...current.emoji, [reaction]: emoji } }));
      };

      const editCustom = (id, field, value) => {
        setDraft((current) => ({
          ...current,
          custom: current.custom.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
        }));
      };

      const addCustom = () => {
        const row = { id: nextRowId(), name: '', emoji: '' };
        setDraft((current) => ({ ...current, custom: [...current.custom, row] }));
        setPicker({ kind: 'custom', key: row.id });
      };

      const removeCustom = (id) => {
        setDraft((current) => ({ ...current, custom: current.custom.filter((row) => row.id !== id) }));
        setPicker((current) => (current !== null && current.kind === 'custom' && current.key === id ? null : current));
      };

      /** Apply a chosen emoji to whatever the open picker targets. */
      const chooseEmoji = (value) => {
        if (picker === null) return;
        const emoji = typeof value === 'string' ? value.trim().slice(0, 8) : '';
        if (emoji === '') return;
        if (picker.kind === 'builtin') setEmoji(picker.key, emoji);
        else editCustom(picker.key, 'emoji', emoji);
      };

      const save = () => {
        const custom = [];
        const names = new Set();
        for (const row of draft.custom) {
          const name = row.name.trim();
          const emoji = row.emoji.trim();
          if (name === '' || emoji === '') {
            setNotice('config.badRow');
            return;
          }
          const key = name.toLowerCase();
          if (names.has(key) || Object.prototype.hasOwnProperty.call(EMOJI, key)) {
            setNotice('config.badRow');
            return;
          }
          names.add(key);
          custom.push({ name, emoji });
        }
        const ops = CONFIG_ROWS.map(([reaction, field]) => ({
          op: 'set',
          path: [field],
          value: draft.emoji[reaction] !== '' ? draft.emoji[reaction] : EMOJI[reaction],
        }));
        ops.push({ op: 'set', path: [CUSTOM_FIELD], value: custom });
        ops.push({ op: 'set', path: ['size'], value: clampSize(draft.size) });
        void write(ops);
      };

      const reset = () => {
        const ops = CONFIG_ROWS.map(([, field]) => ({ op: 'unset', path: [field] }));
        ops.push({ op: 'unset', path: [CUSTOM_FIELD] });
        ops.push({ op: 'unset', path: ['size'] });
        void write(ops);
      };

      const selectedEmoji = (() => {
        if (picker === null) return '';
        if (picker.kind === 'builtin') return draft.emoji[picker.key] ?? '';
        const row = draft.custom.find((entry) => entry.id === picker.key);
        return row !== undefined ? row.emoji : '';
      })();

      const palette = () =>
        h(
          'div',
          { style: PALETTE_PANEL },
          h(
            'div',
            { style: PALETTE_HEAD },
            h('span', { style: CARD_TITLE }, configText(t, 'config.pick')),
            h('button', { type: 'button', onClick: () => setPicker(null), style: TERTIARY_BUTTON }, configText(t, 'config.done')),
          ),
          h(
            'div',
            { style: PALETTE_GRID },
            PALETTE.map((ch) =>
              h(
                'button',
                {
                  key: ch,
                  type: 'button',
                  disabled,
                  'aria-label': ch,
                  onClick: () => chooseEmoji(ch),
                  style: ch === selectedEmoji ? { ...PALETTE_CELL, ...PALETTE_ON } : PALETTE_CELL,
                },
                ch,
              ),
            ),
          ),
          h(
            'div',
            { style: FIELD_LINE },
            h('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, configText(t, 'config.typedEmoji')),
            h('input', {
              type: 'text',
              value: typed,
              maxLength: 8,
              disabled,
              onChange: (event) => {
                setTyped(event.target.value);
                chooseEmoji(event.target.value);
              },
              style: { ...INPUT, width: '120px' },
            }),
          ),
        );

      const builtinCard = h(
        'section',
        { key: 'builtin', style: CARD },
        h(
          'div',
          { style: CARD_HEAD },
          h('h4', { style: CARD_TITLE }, configText(t, 'config.reactions')),
          h('span', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, configText(t, 'config.reactionsHint')),
        ),
        h(
          'div',
          { style: CELL_GRID },
          CONFIG_ROWS.map(([reaction]) => {
            const active = picker !== null && picker.kind === 'builtin' && picker.key === reaction;
            return h(
              'button',
              {
                key: reaction,
                type: 'button',
                disabled,
                'aria-pressed': active ? 'true' : 'false',
                title: reactionLabel(t, reaction),
                onClick: () => setPicker(active ? null : { kind: 'builtin', key: reaction }),
                style: active ? { ...CELL, ...CELL_ON } : CELL,
              },
              h('span', { style: CELL_EMOJI, 'aria-hidden': 'true' }, draft.emoji[reaction] ?? EMOJI[reaction]),
              h('span', { style: CELL_NAME }, reactionLabel(t, reaction)),
            );
          }),
        ),
        picker !== null && picker.kind === 'builtin' ? palette() : null,
      );

      const customCard = h(
        'section',
        { key: 'custom', style: CARD },
        h(
          'div',
          { style: CARD_HEAD },
          h('h4', { style: CARD_TITLE }, configText(t, 'config.custom')),
          h('button', { type: 'button', disabled, onClick: addCustom, style: TERTIARY_BUTTON }, configText(t, 'config.add')),
        ),
        h('p', { style: CARD_HINT }, configText(t, 'config.customHint')),
        draft.custom.length === 0
          ? h('p', { style: EMPTY }, configText(t, 'config.empty'))
          : h(
              'div',
              { style: ROW_LIST },
              draft.custom.map((row) => {
                const active = picker !== null && picker.kind === 'custom' && picker.key === row.id;
                return h(
                  'div',
                  { key: row.id, style: ROW },
                  h(
                    'button',
                    {
                      type: 'button',
                      disabled,
                      'aria-label': configText(t, 'config.pick'),
                      title: configText(t, 'config.pick'),
                      onClick: () => setPicker(active ? null : { kind: 'custom', key: row.id }),
                      style: active ? { ...EMOJI_BUTTON, ...CELL_ON } : EMOJI_BUTTON,
                    },
                    row.emoji !== '' ? row.emoji : '＋',
                  ),
                  h('input', {
                    type: 'text',
                    value: row.name,
                    maxLength: 24,
                    disabled,
                    placeholder: configText(t, 'config.namePlaceholder'),
                    'aria-label': configText(t, 'config.custom'),
                    onChange: (event) => editCustom(row.id, 'name', event.target.value),
                    style: INPUT,
                  }),
                  h(
                    'button',
                    {
                      type: 'button',
                      disabled,
                      'aria-label': configText(t, 'config.remove'),
                      title: configText(t, 'config.remove'),
                      onClick: () => removeCustom(row.id),
                      style: REMOVE_BUTTON,
                    },
                    '×',
                  ),
                );
              }),
            ),
        picker !== null && picker.kind === 'custom' ? palette() : null,
      );

      const previews = [
        h(
          'span',
          {
            key: 'like',
            style: { ...BUBBLE_PILL, fontSize: `${clamped}px`, lineHeight: `${clamped + 4}px` },
          },
          h('span', { style: { fontSize: `${clamped + 1}px`, lineHeight: 1 }, 'aria-hidden': 'true' }, draft.emoji.like ?? EMOJI.like),
          h('span', null, configText(t, 'config.previewComment')),
        ),
      ];
      const firstCustom = draft.custom.find((row) => row.name.trim() !== '' && row.emoji.trim() !== '');
      if (firstCustom !== undefined) {
        previews.push(
          h(
            'span',
            {
              key: 'custom',
              style: { ...BUBBLE_PILL, fontSize: `${clamped}px`, lineHeight: `${clamped + 4}px` },
            },
            h('span', { style: { fontSize: `${clamped + 1}px`, lineHeight: 1 }, 'aria-hidden': 'true' }, firstCustom.emoji),
            h('span', null, firstCustom.name.trim()),
          ),
        );
      }

      const sizeCard = h(
        'section',
        { key: 'size', style: CARD },
        h(
          'div',
          { style: CARD_HEAD },
          h('h4', { style: CARD_TITLE }, configText(t, 'config.size')),
          h('span', { style: { color: 'var(--dsw-alias-label-secondary)' } }, `${clamped} px`),
        ),
        h('input', {
          type: 'range',
          min: MIN_SIZE,
          max: MAX_SIZE,
          step: 1,
          value: clamped,
          disabled,
          'aria-label': configText(t, 'config.size'),
          onChange: (event) => setDraft((current) => ({ ...current, size: Number(event.target.value) })),
          style: RANGE,
        }),
        h(
          'div',
          { style: PREVIEW_BOX, 'data-emoji-reaction-preview': true },
          h('span', { style: PREVIEW_CAPTION }, configText(t, 'config.preview')),
          h('span', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, previews),
        ),
      );

      const actions = h(
        'div',
        { key: 'actions', style: ACTIONS },
        h(
          'button',
          { type: 'button', disabled, onClick: save, style: disabled ? { ...PRIMARY, opacity: '0.55' } : PRIMARY },
          configText(t, busy ? 'config.saving' : 'config.save'),
        ),
        h('button', { type: 'button', disabled, onClick: reset, style: SECONDARY }, configText(t, 'config.reset')),
        notice === null ? null : h('span', { role: 'status', style: NOTICE }, configText(t, notice)),
      );

      return h(
        'section',
        { style: PAGE, 'data-emoji-reaction-config': true },
        h(
          'header',
          { style: HEADER },
          h('h3', { style: TITLE }, configText(t, 'config.title')),
          h('p', { style: HINT }, configText(t, values === null ? 'config.loading' : 'config.hint')),
        ),
        values === null ? null : builtinCard,
        values === null ? null : customCard,
        values === null ? null : sizeCard,
        values === null ? null : actions,
      );
    }

    /**
     * The Plugins detail page: the owner hands the row's form over as `{ state, mutate }`.
     * @param props - the Host-owned form plus the locale seat.
     * @returns the shared settings form.
     */
    function ReactionConfigPage({ form, t }) {
      const state = form !== null && form !== undefined && form.state !== null && typeof form.state === 'object' ? form.state : null;
      const mutate = form !== null && form !== undefined && typeof form.mutate === 'function' ? form.mutate : null;
      return h(ReactionForm, { state, mutate, t });
    }

    /**
     * Follow one `configForms` controller. The controller is a snapshot store over the Host's
     * describe document, so subscribing here keeps every open Settings page on the served values.
     * @param form - the controller `configForms.get` returned, or nothing.
     * @returns the controller's current snapshot.
     */
    function useConfigState(form) {
      const [state, setState] = React.useState(() => (form !== null && form !== undefined ? form.getSnapshot() : null));
      React.useEffect(() => {
        if (form === null || form === undefined) return undefined;
        setState(form.getSnapshot());
        return form.subscribe(() => setState(form.getSnapshot()));
      }, [form]);
      return state;
    }

    /**
     * The Settings section page. Registration is owned by `configForms.whileServed`, so the
     * section exists only while the Host actually serves this namespace; the page then reads and
     * writes the same document the Plugins row page edits.
     * @param props - the shared form controller plus the locale seat.
     * @returns the shared settings form.
     */
    function EmojiSettingsPage({ form, t }) {
      const state = useConfigState(form);
      const mutate = form !== null && form !== undefined ? (ops, revision) => form.mutate(ops, revision) : null;
      return h(ReactionForm, { state, mutate, t });
    }

    /**
     * `plugins.row.config` entry for this bundle's row: `summary` is the one-liner, `page` the form.
     * @param props - the view the owner asks for, the Host-owned form, and the locale seat.
     * @returns the projected view.
     */
    function ReactionConfig(props) {
      if (props.view === 'summary') return h(ReactionConfigSummary, { t: props.t });
      return h(ReactionConfigPage, { form: props.form, t: props.t });
    }

    const inject = ['slots', 'locale'];

    /**
     * Client plugin body: publish the dictionaries, claim the keyed tool view for
     * `express_reaction`, and decorate the user bubble that owns each reaction.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, LABELS), 'emoji-reaction: dictionaries');
      ctx.slots.inject('tool.call.toolview', () =>
        ctx.slots.register({ name: 'tool.call.toolview', key: TOOL_NAME, locale: NS }, HiddenToolRow),
      );
      ctx.slots.inject('conversation.chat.user.before', () =>
        ctx.slots.register(
          {
            name: 'conversation.chat.user.before',
            locale: NS,
            select: (owner) => (owner !== null && typeof owner === 'object' && owner.kind === 'user' ? owner.source ?? null : null),
          },
          UserReactionBubble,
        ),
      );
      ctx.slots.inject('plugins.row.config', () =>
        ctx.slots.register({ name: 'plugins.row.config', key: `${PACKAGE_NAME}#${ROW_ID}`, locale: NS }, ReactionConfig),
      );
      // The Settings page needs the settings service, which a deployment may not compose; the
      // scoped inject keeps the bubble and the row alive either way.
      ctx.inject(['configForms'], (scope) => {
        try {
          const forms = scope.configForms;
          if (typeof forms.get !== 'function' || typeof forms.whileServed !== 'function') return;
          if (typeof scope.locale.bind !== 'function') return;
          const form = forms.get(ROW_ID);
          const sectionText = scope.locale.bind(NS);
          scope.effect(
            () =>
              forms.whileServed([ROW_ID], () =>
                scope.slots.inject('settings.section', () =>
                  scope.slots.register(
                    {
                      name: 'settings.section',
                      id: ROW_ID,
                      order: 25,
                      label: () => sectionText('nav'),
                      locale: NS,
                      inject: () => ({ form, t: sectionText }),
                    },
                    EmojiSettingsPage,
                  ),
                ),
              ),
            'emoji-reaction: settings section',
          );
        } catch (error) {
          // A missing or differently shaped settings service must not take the stamps down with it.
          console.warn('[emoji-reaction] 设置页没有挂上：', error);
        }
      });
    }

    return { inject, apply };
  },
});