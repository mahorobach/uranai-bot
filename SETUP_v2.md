# セットアップガイド v2.0 - Claude AI + Supabase 対応版

占いの館が進化しました！**Claude AI** による感動的な鑑定体験と **Supabase** によるスケーラブなデータベースを統合した版です。

## 🎯 新機能

✨ **Claude API による感動的な鑑定**

- AIが個人に合わせた自然な占いテキストを生成
- 「自分のことをわかってもらえた感」を演出

💾 **Supabase によるスケーラブルなキャッシング**

- 占い結果を自動保存
- 同じ条件の人にはキャッシュから高速取得
- 成長に応じて容易にスケール可能

👤 **ユーザー管理**

- LINE ユーザーの自動識別
- 占い履歴の保存・管理

🔄 **自動キャッシング**

- Claude API 呼び出しを削減
- レスポンス時間を短縮

---

## ステップ 1: Supabase セットアップ（必須）

Supabase は無料で使用できます。スケーラブなバックエンドを何分で構築できます。

### 1.1 Supabase アカウント作成

1. [supabase.com](https://supabase.com) にアクセス
2. 「Start your project」をクリック
3. GitHub アカウントでログイン（推奨）
4. 新しい Organization を作成

### 1.2 プロジェクト作成

1. 「New Project」をクリック
2. プロジェクト名: 「fortune-hall」など
3. Database Password を設定（復雑なパスワード推奨）
4. リージョンを選択（日本なら「Tokyo」）
5. 「Create new project」をクリック

プロジェクトが起動するまで 1-2分待ちます。

### 1.3 データベーススキーマ設定

1. Supabase ダッシュボードを開く
2. 左メニューの「SQL Editor」をクリック
3. 「New Query」をクリック
4. [`db/schema.sql`](../db/schema.sql) の全コンテンツをコピー
5. SQL エディタに貼り付け
6. 「RUN」をクリック

✅ テーブルが 4つ作成されます：

- `fortune_cache` - 占い結果キャッシュ
- `users` - ユーザー管理
- `user_fortunes` - 占い履歴
- `payments` - 決済管理

### 1.4 認証情報を取得

1. 左メニューの「Settings」 → 「API」をクリック
2. 以下をコピー：
   - **Project URL** → `SUPABASE_URL`
   - **anon public** キー → `SUPABASE_ANON_KEY`
   - **service_role** シークレットキー → `SUPABASE_SERVICE_KEY`（有料版用）

---

## ステップ 2: Claude API キーを取得

### 2.1 Anthropic API キー取得

1. [console.anthropic.com](https://console.anthropic.com) にアクセス
2. ログイン（Anthropic アカウント必須）
3. 左メニューの「API Keys」をクリック
4. 「Create Key」をクリック
5. キーをコピー → `.env` に貼り付け

**注**: Claude API は従量課金（1M入力トークン $3、1M出力トークン $15ドル程度）

- テストには無料クレジット（$5）がもらえます

---

## ステップ 3: 環境変数を設定

### 3.1 .env ファイルを作成

```bash
cd /Users/akaohiroshi/Documents/Cursor/LINE占い
cp .env.example .env
```

### 3.2 .env を編集

```env
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=YOUR_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET=YOUR_CHANNEL_SECRET

# Claude API
CLAUDE_API_KEY=sk-ant-v0-xxxxx

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxxx
SUPABASE_SERVICE_KEY=eyJxxxxxx

# 決済（後で設定）
# STRIPE_SECRET_KEY=sk_test_xxxxx
# STRIPE_PUBLIC_KEY=pk_test_xxxxx

# サーバー
PORT=3000
NODE_ENV=development
PAID_FORTUNE_PRICE_JPY=1000
```

**重要**: `.env` を `.gitignore` に追加（既に設定済み）

---

## ステップ 4: LINE Messaging API を設定

### 4.1 LINE Developers Console

1. [developers.line.biz](https://developers.line.biz) にアクセス
2. ログイン → プロバイダー作成 → チャネル作成（Messaging API）
3. **Channel Access Token** と **Channel Secret** を取得
4. `.env` に入力

### 4.2 Webhook URL 設定

1. LINE Developers Console で「Messaging API設定」タブ
2. 「Webhook URL」に以下を入力

**開発環境（ローカル）:**

```
http://localhost:3000/webhook
```

**本番環境:**

```
https://your-domain.com/webhook
```

**ローカルテスト用に Ngrok を使う場合:**

別のターミナルで実行：

```bash
ngrok http 3000
```

Ngrok の URL（例：`http://abc123.ngrok.io`）を使用：

```
http://abc123.ngrok.io/webhook
```

---

## ステップ 5: サーバーを起動

### 5.1 開発モード（自動リロード）

```bash
npm run dev
```

### 5.2 本番モード

```bash
npm start
```

### 5.3 ログを確認

起動時に以下が表示されたら成功：

```
╔════════════════════════════════════════╗
║  🔮 占いの館 LINE Bot - 感動版        ║
║  Claude AI × Supabase 統合            ║
╚════════════════════════════════════════╝

✅ サーバー起動: http://localhost:3000
📍 Webhook URL: http://localhost:3000/webhook

【機能】
  🤖 Claude API による感動的な鑑定
  💾 Supabase キャッシング
  📱 LINE Messaging API
  👤 ユーザー管理
  🔄 占い履歴保存

準備完了！
```

---

## ステップ 6: LINE Official Account を作成・テスト

### 6.1 Official Account を作成

1. LINE Developers Console で「Messaging API設定」タブ
2. 「Your LINE Official Account」セクションを確認
3. QRコードをスキャンして「友達追加」

### 6.2 テストメッセージを送信

LINE チャットで以下を入力：

```
田中太郎 1990-05-15
```

**期待される応答:**

- 最初の呼び出しなら Claude に問い合わせ（3-5秒）
- 結果がキャッシュされる
- 同じ条件なら 2回目以降は即座に返答

---

## トラブルシューティング

### Claude API キーが無効

```
Error: API request failed with status 401
```

**対応**: `.env` の `CLAUDE_API_KEY` が正しくコピーされているか確認

### Supabase に接続できない

```
Error: connect ENOTFOUND xxxxx.supabase.co
```

**対応**:

- `SUPABASE_URL` が正しいか確認
- インターネット接続を確認

### メッセージに返信がない

**対応**:

- LINE アカウントをフォローしているか確認
- Channel Secret が正しいか確認
- Webhook が「有効」に設定されているか確認
- サーバーログを確認（`npm run dev` の出力）

### 占い結果が毎回同じ

これは正常です。Claude API は毎回違う表現で鑑定文を生成しますが、Supabase にキャッシュされた結果が返されるため、同じテキストが返されます。**これは機能です**。

---

## 次のステップ

### フェーズ 2（1-2週間後）

- Stripe 決済統合
- 有料版鑑定コンテンツ
- リッチメッセージ対応

### フェーズ 3（1ヶ月後）

- Web UI を追加
- ユーザーダッシュボード
- 占い履歴表示

### フェーズ 4（2-3ヶ月後）

- 相性占い機能
- AI による詳細分析
- 月別運勢トレンド

---

## セキュリティ上の注意

⚠️ **本番運用前に確認してください:**

1. ✅ `.env` は絶対に Git にコミットしない（`.gitignore` で除外済み）
2. ✅ Claude API キーを誰にも教えない
3. ✅ Supabase の RLS（Row Level Security）を設定
4. ✅ HTTPS を使用する（本番環境）
5. ✅ API 呼び出し制限を設定

---

**準備完了！素晴らしい占い体験を提供する準備ができました。**

質問・問題がある場合は、ログを確認してください。
