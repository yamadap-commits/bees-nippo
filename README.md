# bees-nippo

社内向けの日報ツール。1人で入力し、社内メンバーは URL から閲覧する想定。

- 今日の日報トップ（`#/`）
- アーカイブ（`#/archive`） — 日付・案件横断検索つき
- エディタ（`#/edit`） — 自分専用。下書きは自動で localStorage に保存。

未完了の案件は翌日の日報に**前日のメモごと**自動で繰り越される。完了チェックを入れた翌日からは消える。

`data.json` はパスワードで暗号化（AES-GCM 256 + PBKDF2-SHA256 / 200,000 iter）可能。社内メンバーには Discord ピン留めなどでパスワードを共有しておけば、URL が外部に漏れても中身は読めない。

## 開発

```bash
npm install
npm run dev
```

ローカル URL: `http://localhost:5173/bees-nippo/`

## デプロイ（GitHub Pages）

1. このリポジトリを GitHub に push
2. リポジトリの Settings → Pages → Source を **GitHub Actions** に切り替える
3. `main` に push すると自動でデプロイ
4. 公開 URL: `https://<github-user>.github.io/bees-nippo/`

## 日々の運用フロー

1. `#/edit` を開く
2. 前日のアクティブ案件＋メモが繰り越されているので、変わった案件だけ書き換える
   - 「前日コピー」ボタンで前日メモを再投入できる
   - 「今日から外す」で今日の日報には載せない（案件自体は残る）
3. 完了した案件にチェック → 翌日からは消える（その日には「完了」バッジ）
4. 「今日のひとこと」を入力
5. 必要ならパスワードを設定／変更（暗号化したい場合は「暗号化する」にチェック）
6. **「暗号化して保存」** → `data.json` がダウンロード
7. リポジトリの `public/data/data.json` を上書きして commit & push
8. GitHub Actions のデプロイ完了後、トップで **「Discord 用テキストをコピー」**
9. Discord に貼り付け

## パスワードについて

- ブラウザに記憶可能（チェック付きで localStorage、外すと sessionStorage）
- 「🔒」ボタンでパスワードを忘れさせる
- 閲覧者は URL を開くとパスワード入力画面に通される
- 変更したいときはエディタのパスワード欄に新しいものを入れて再ダウンロード

## データの場所

- マスター: `public/data/data.json`（暗号化 JSON または平文 JSON）
- 下書き: ブラウザの localStorage（キー: `bees-nippo:draft`）
- 記憶済みパスワード: `bees-nippo:password`（local or session storage）

下書きは「下書きを破棄」ボタンでクリアできる。
