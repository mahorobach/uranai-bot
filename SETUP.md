# セットアップガイド

占いの館の LINE Bot を起動するための手順です。

## ステップ1: LINE Developers Console で設定

### 1.1 プロバイダー作成

1. [LINE Developers Console](https://developers.line.biz) にアクセス
2. LINE仕事用アカウントでログイン
3. 「新規プロバイダー作成」をクリック
4. プロバイダー名を入力（例：「占いの館」）

### 1.2 チャネル作成

1. 作成したプロバイダーをクリック
2. 「チャネル作成」をクリック
3. チャネルタイプ: **Messaging API** を選択
4. チャネル名、説明を入力
5. チャネルを作成

### 1.3 認証情報の取得

1. 作成したチャネルの「設定」タブを開く
2. 「チャネル基本設定」セクションまで下へスクロール
3. **Channel Secret** をコピー（.env ファイルに貼り付け）
4. 「Messaging API設定」タブを開く
5. **Channel Access Token** を生成してコピー（.env ファイルに貼り付け）

### 1.4 Webhook URL の設定

1. 「Messaging API設定」タブを開く
2. 「Webhook URL」フィールドに以下を入力（**※後で更新**）
   - 開発時: `http://localhost:3000/webhook`
   - 本番環境: 公開 URL（例：`https://your-domain.com/webhook`）
3. 「Webhook」を有効にする

## ステップ2: ローカル環境で起動

### 2.1 .env ファイルを作成

```bash
cd /Users/akaohiroshi/Documents/Cursor/LINE占い
cp .env.example .env
```

### 2.2 .env を編集

ダッシュボードでコピーした認証情報を入力：

```
LINE_CHANNEL_ACCESS_TOKEN=<コピーしたアクセストークン>
LINE_CHANNEL_SECRET=<コピーしたチャネルシークレット>
PORT=3000
NODE_ENV=development
```

### 2.3 サーバー起動

```bash
npm run dev
```

起動時に以下が表示されたら成功：

```
✅ LINE Bot Server running on port 3000
📍 Webhook URL: http://localhost:3000/webhook
```

## ステップ3: Ngrok を使ってテスト（ローカル環境の公開）

Webhook が機能するには、LINE サーバーがあなたのサーバーにアクセスできる必要があります。
開発環境では **Ngrok** を使って localhost をインターネット公開します。

### 3.1 Ngrok をインストール

```bash
# macOS (Homebrew)
brew install ngrok

# または公式サイトからダウンロード
# https://ngrok.com/download
```

### 3.2 Ngrok を実行

別のターミナルウィンドウで：

```bash
ngrok http 3000
```

実行結果：

```
ngrok by @inconshreveable                    (Ctrl+C to quit)
...
Forwarding    http://1234567890ab.ngrok.io -> http://localhost:3000
```

### 3.3 LINE Developers Console で Webhook URL を更新

1. LINE Developers Console を開く
2. 「Messaging API設定」タブ
3. 「Webhook URL」に以下を入力：
   ```
   http://1234567890ab.ngrok.io/webhook
   ```
4. 「更新」をクリック

### 3.4 テスト

LINE Official Account（QRコード）をスキャンして、メッセージを送信：

```
太郎 1990-05-15
```

占い結果が返ってきたら成功！

## トラブルシューティング

### エラー: "LINE_CHANNEL_ACCESS_TOKEN が見つかりません"

- `npm start` の前に `.env` ファイルが作成されているか確認
- 環境変数が正しく設定されているか確認

### エラー: "Webhook の検証に失敗しました"

- Webhook URL が正しく設定されているか確認（Ngrok の URL）
- サーバーが起動しているか確認
- ファイアウォール設定を確認

### メッセージに返信すらない

- LINE アカウントをフォローしているか確認
- Channel Secret と Channel Access Token が正しいコピーか確認
- LINE Developers Console で「Webhook 使用」が「有効」になっているか確認

---

次のステップ：すべて設定完了したら、さらに複雑な機能の追加を進めます。
