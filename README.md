# ハチワレバレット

公開中のバレットジャーナルPWAを、MacBook / Windows / iPhone で同じコードとして扱えるように保存したソースです。

## 保存場所

このコードは現在、GitHubリポジトリ `Ginji001/Project01` の **`hachiware-bullet` ブランチ** に独立保存しています。

GitHub接続機能に新規リポジトリ作成APIが無いため、既存 `master` を変更せず、専用ブランチへ隔離して保存しています。

## 公開中URL

https://hibicho-daily-journal.emiya2170.chatgpt.site/

## 主な機能

- 今日 / デイリーログ
- マンスリーログ
- 6か月フューチャーログ
- ハビットトラッカー
- 家計簿
- コレクション
- バレット記号ルール
- ライト / ダーク表示
- JSONバックアップ / 復元
- PWA / オフライン対応

## Mac / Windows 共通運用

GitHub Desktopで `Ginji001/Project01` をCloneし、ブランチを `hachiware-bullet` に切り替えれば、MacBookとWindowsの両方で同じソースをPull / Commit / Pushできます。

入力した日記・家計・習慣データはGitHubへ送らず、各端末のブラウザ内に保存します。端末間で入力データを移す場合は、アプリの「設定 → データを書き出す / 読み込む」を使用します。

## ソース形式

`app.js.gz` と `styles.css.gz` は、回収済みの実ソースをそのままgzip圧縮したものです。`index.html` がブラウザ上で自動展開して実行します。

既存の `master` ブランチは変更しません。
