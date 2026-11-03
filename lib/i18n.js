// Interface texts in English and Japanese. Works in the page and in the worker (no DOM here).
// Static texts in index.html name their key with data-i18n (plain text) or data-i18n-html (text with markup).

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: 'uk' },
  { code: 'ja', name: '日本語', flag: 'japan' },
];

const SPHAIRA = '<a href="https://github.com/NaGaa95/sphaira/releases" target="_blank" rel="noopener">Sphaira</a>';
const GAME_PATH = '<code>Content/&lt;profile&gt;/58410A8C/000D0000</code>';
const DLC_PATH = '<code>Content/&lt;profile&gt;/58410A8C/00000002</code>';

const TEXTS = {
  en: {
    legal:
      'PAC-MAN is a trademark of Bandai Namco Entertainment Inc. The icon artwork is © Bandai Namco. pacman-nx is an unofficial fan project and is not affiliated with or endorsed by Bandai Namco, Nintendo or Microsoft.',
    sourceCode: 'Source code',
    signature: 'a ChanseyIsTheBest project',
    lead:
      'Builds the <strong>Nintendo Switch</strong> package of <strong>PAC-MAN Championship Edition DX</strong> from your own ' +
      '<strong>Xbox 360</strong> copy. Everything runs in <strong>this browser</strong>.',
    languageBar: 'Language',
    step1: '1. Choose your game',
    formatPackage: 'Game package',
    formatFolder: 'Folder',
    ownCopy:
      '<strong>Important:</strong> you need your own copy of the game, from your own Xbox 360. The installer reads the game from it to make the package; without it there is nothing to play. Nothing is uploaded: your files never leave this computer.',
    formatHint:
      `<strong>Game package:</strong> the game's file in ${GAME_PATH} on your console's storage. You can choose the DLC package in ${DLC_PATH} along with it (optional).<br>` +
      '<strong>Folder:</strong> a folder you extracted the game into (with <code>default.xex</code>); a DLC package file inside it is found too.',
    nothingChosen: 'Nothing chosen yet.',
    chosenGame: 'Game: {name} ({size})',
    chosenDlc: 'DLC: {name} ({size})',
    chosenNoDlc: 'No DLC (optional)',
    step2: '2. Create the package',
    step2First: 'If you are installing the game for the first time, use:',
    create: 'Create pacman-nx.zip',
    step2Update:
      'If the game is already installed and you only want to update it (<code>pacman-nx.nro</code> and the shaders, plus the DLC if you chose it), use:',
    createUpdate: 'Create pacman-nx-update.zip',
    step3: '3. Copy it to the Switch',
    step3Extract: 'Extract the downloaded zip into <code>sdmc:/switch/</code>.',
    step3Start:
      'Start <code>pacman-nx.nro</code> from the Homebrew Menu in title takeover mode (<strong>launch</strong> a game installed on the Switch ' +
      `<strong>while holding R</strong>) or create a <strong>39-bit forwarder</strong> with ${SPHAIRA}. The album applet does not give the game enough memory.`,
    step3First:
      'The first start takes longer if you added the DLC, because the game installs it then. The first time you play, new screens can <strong>stutter</strong> for a moment while the graphics are prepared; they are kept on the SD card for the next time.',
    checking: 'Checking your game…',
    supported: 'Xbox 360 version · supported',
    supportedWithDlc: 'Xbox 360 version + DLC · supported',
    unsupported: 'This version of the game is not supported yet.',
    notGame: 'Not the game',
    noGame: 'The game was not found: choose its package, or a folder with default.xex.',
    otherTitle: '{name} is not PAC-MAN Championship Edition DX.',
    noStreaming: 'this browser window cannot stream downloads. Use a normal (not private) window.',
    downloadStarted: 'Download started ({size}). Keep this page open until it finishes.',
    finished: 'Finished in {seconds} s.',
    error: 'Error: {message}',
    cancelled: 'the download was cancelled',
    readingFiles: 'Reading your game',
    downloadingBuild: 'Downloading the Switch build',
    logBuild: 'Supported: PAC-MAN Championship Edition DX for Xbox 360 (build {version})',
    logUpdate: 'Update package: pacman-nx.nro and the shaders (and the DLC, if you chose it)',
    logDlc: 'DLC: {name}',
    deko3dShaders: "Making the {count} shaders of the deko3d renderer from the game's files",
    deko3dReady: 'deko3d shaders ready: they match the tested ones',
    gameIdentical: 'The game files are identical in number and size to the tested copy',
    gameDifferent: 'Warning: the game files differ from the tested copy (modified or damaged files?). The package is made anyway.',
    packing: 'Writing the package',
    done: 'Done: extract the zip into sdmc:/switch/',
    notSupportedYet: 'this version of the game is not supported yet. Executable fingerprint: {hash}',
    buildMismatch: 'the downloaded Switch build is not the published one ({hash}); try again later',
    deko3dContainers: "the deko3d renderer's shaders were not all found in the game's files ({found} of {wanted}); nothing was written",
    deko3dMismatch: "the deko3d renderer's shaders do not match the tested ones ({hash}); nothing was written",
    incompleteGame: 'Incomplete game: {count} of {expected} files. Only the update package can be made.',
    incompleteError: 'the game is incomplete ({count} of {expected} files): choose the whole game',
    downloadFailed: 'could not download {url} ({status})',
  },
  ja: {
    legal:
      'PAC-MAN はバンダイナムコエンターテインメントの商標です。アイコンのアートワークは © Bandai Namco です。pacman-nx は非公式のファンプロジェクトであり、バンダイナムコ、任天堂、マイクロソフトとは一切関係がなく、承認も受けていません。',
    sourceCode: 'ソースコード',
    signature: 'ChanseyIsTheBest のプロジェクト',
    lead:
      'ご自身の <strong>Xbox 360</strong> 版から、<strong>PAC-MAN Championship Edition DX</strong> の <strong>Nintendo Switch</strong> 用パッケージを作成します。すべて<strong>このブラウザ内</strong>で処理されます。',
    languageBar: '言語',
    step1: '1. ゲームを選ぶ',
    formatPackage: 'ゲームパッケージ',
    formatFolder: 'フォルダー',
    ownCopy:
      '<strong>重要：</strong>ご自身の Xbox 360 にあるゲームが必要です。インストーラーはそこからゲームを読み込んでパッケージを作成します。何もアップロードされません。ファイルがこのコンピューターの外に出ることはありません。',
    formatHint:
      `<strong>ゲームパッケージ：</strong>本体ストレージの ${GAME_PATH} にあるゲームのファイル。${DLC_PATH} の DLC パッケージも一緒に選べます（任意）。<br>` +
      '<strong>フォルダー：</strong>ゲームを展開したフォルダー（<code>default.xex</code> を含むもの）。中にある DLC パッケージも見つけます。',
    nothingChosen: 'まだ何も選ばれていません。',
    chosenGame: 'ゲーム：{name}（{size}）',
    chosenDlc: 'DLC：{name}（{size}）',
    chosenNoDlc: 'DLC なし（任意）',
    step2: '2. パッケージを作成する',
    step2First: '初めてゲームをインストールする場合：',
    create: 'pacman-nx.zip を作成',
    step2Update: 'インストール済みで、更新（<code>pacman-nx.nro</code> とシェーダー、選んだ場合は DLC も）だけを行う場合：',
    createUpdate: 'pacman-nx-update.zip を作成',
    step3: '3. Switch にコピーする',
    step3Extract: 'ダウンロードした zip を <code>sdmc:/switch/</code> に展開します。',
    step3Start:
      '<strong>タイトル乗っ取りモード</strong>の Homebrew Menu から <code>pacman-nx.nro</code> を起動するか（Switch にインストールされたゲームを <strong>R を押しながら起動</strong>）、' +
      `${SPHAIRA} で <strong>39 ビットのフォワーダー</strong>を作成します。アルバムアプレットではゲームに必要なメモリが足りません。`,
    step3First:
      'DLC を追加した場合、初回起動時にゲームがインストールするため時間がかかります。初めてプレイするときは、グラフィックの準備のため、新しい画面で一瞬<strong>カクつく</strong>ことがあります。準備したものは SD カードに保存され、次回からは使い回されます。',
    checking: 'ゲームを確認しています…',
    supported: 'Xbox 360 版 · 対応',
    supportedWithDlc: 'Xbox 360 版 + DLC · 対応',
    unsupported: 'このバージョンのゲームにはまだ対応していません。',
    notGame: 'ゲームではありません',
    noGame: 'ゲームが見つかりません。ゲームパッケージ、または default.xex を含むフォルダーを選んでください。',
    otherTitle: '{name} は PAC-MAN Championship Edition DX ではありません。',
    noStreaming: 'このブラウザウィンドウではダウンロードをストリーミングできません。通常の（プライベートではない）ウィンドウを使ってください。',
    downloadStarted: 'ダウンロードを開始しました（{size}）。完了するまでこのページを開いたままにしてください。',
    finished: '{seconds} 秒で完了しました。',
    error: 'エラー：{message}',
    cancelled: 'ダウンロードがキャンセルされました',
    readingFiles: 'ゲームを読み込んでいます',
    downloadingBuild: 'Switch 版をダウンロードしています',
    logBuild: '対応：Xbox 360 版 PAC-MAN Championship Edition DX（ビルド {version}）',
    logUpdate: '更新パッケージ：pacman-nx.nro とシェーダー（選んだ場合は DLC も）',
    logDlc: 'DLC：{name}',
    deko3dShaders: 'ゲームのファイルから deko3d レンダラーの {count} 個のシェーダーを作成しています',
    deko3dReady: 'deko3d シェーダーの準備ができました（テスト済みのものと一致）',
    gameIdentical: 'ゲームファイルの数とサイズはテスト済みのコピーと同一です',
    gameDifferent: '警告：ゲームファイルがテスト済みのコピーと異なります（改変または破損したファイル？）。パッケージはそのまま作成します。',
    packing: 'パッケージを書き込んでいます',
    done: '完了：zip を sdmc:/switch/ に展開してください',
    notSupportedYet: 'このバージョンのゲームにはまだ対応していません。実行ファイルのフィンガープリント：{hash}',
    buildMismatch: 'ダウンロードした Switch 版が公開版と一致しません（{hash}）。しばらくしてからもう一度お試しください',
    deko3dContainers: 'deko3d レンダラーのシェーダーがゲームのファイルにすべて見つかりません（{wanted} 個中 {found} 個）。何も書き込まれていません',
    deko3dMismatch: 'deko3d レンダラーのシェーダーがテスト済みのものと一致しません（{hash}）。何も書き込まれていません',
    incompleteGame: 'ゲームが不完全です：{expected} ファイル中 {count} ファイル。更新パッケージのみ作成できます。',
    incompleteError: 'ゲームが不完全です（{expected} ファイル中 {count} ファイル）。ゲーム全体を選んでください',
    downloadFailed: '{url} をダウンロードできませんでした（{status}）',
  },
};

let current = 'en';

export function getLanguage() {
  return current;
}

export function setLanguage(code) {
  current = TEXTS[code] ? code : 'en';
  return current;
}

// The visitor's choice (saved in their browser), else the browser's language when it is one of ours, else English.
export function preferredLanguage(saved, browser = []) {
  if (saved && TEXTS[saved]) {
    return saved;
  }
  for (const tag of browser) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (TEXTS[code]) {
      return code;
    }
  }
  return 'en';
}

export function t(key, params = {}) {
  const text = TEXTS[current][key] ?? TEXTS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}

// Sizes as Windows Explorer shows them, so the page and the file's properties agree: units of 1024 bytes (which
// Windows calls KB, MB and GB) and three significant digits, truncated. 7,834,892,288 bytes is 7.29 GB, not 7.83.
const SIZE_UNITS = {};

export function formatSize(bytes) {
  const units = SIZE_UNITS[current] ?? ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const scale = 10 ** decimals;
  // The small epsilon keeps values such as 7.3 from becoming 7.29 through floating point.
  const shown = Math.floor(value * scale + 1e-9) / scale;
  const number = new Intl.NumberFormat(current, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${number.format(shown)} ${units[unit]}`;
}
