import { useEffect, useState } from "react";
import {
  forgetPassword,
  loadData,
  recallPassword,
  rememberPassword,
  type LoadResult,
} from "./data";
import { decryptJson, type EncryptedBlob } from "./crypto";
import { emptyData, type DataFile } from "./types";
import Today from "./views/Today";
import Archive from "./views/Archive";
import Editor from "./views/Editor";

type Route = "today" | "archive" | "editor";

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("archive")) return "archive";
  if (h.startsWith("edit")) return "editor";
  return "today";
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute());
  const [load, setLoad] = useState<LoadResult | null>(null);
  const [data, setData] = useState<DataFile | null>(null);
  const [password, setPassword] = useState<string | null>(() => recallPassword());
  const [pwError, setPwError] = useState<string>("");
  const [pwInput, setPwInput] = useState("");
  const [pwPersistent, setPwPersistent] = useState(true);

  useEffect(() => {
    void loadData().then(setLoad);
    const onHash = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!load) return;
    if (load.kind === "plain") {
      setData(load.data);
      return;
    }
    if (load.kind === "empty") {
      setData(structuredClone(emptyData));
      return;
    }
    if (password) {
      tryDecrypt(load.blob, password, false);
    }
  }, [load, password]);

  const tryDecrypt = async (
    blob: EncryptedBlob,
    pw: string,
    persistent: boolean,
  ) => {
    try {
      const decoded = await decryptJson<DataFile>(blob, pw);
      setData({
        projects: decoded.projects ?? [],
        reports: decoded.reports ?? {},
      });
      setPassword(pw);
      rememberPassword(pw, persistent);
      setPwError("");
      setPwInput("");
    } catch {
      setPwError("パスワードが違います。");
      setData(null);
      forgetPassword();
      setPassword(null);
    }
  };

  const handleForget = () => {
    forgetPassword();
    setPassword(null);
    setData(null);
  };

  if (load === null) {
    return (
      <div className="app">
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  if (load.kind === "encrypted" && !data) {
    return (
      <div className="gate-wrap">
        <form
          className="gate"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwInput) void tryDecrypt(load.blob, pwInput, pwPersistent);
          }}
        >
          <h1>日報</h1>
          <p className="muted">パスワードを入力してください</p>
          <input
            type="password"
            autoFocus
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            placeholder="パスワード"
          />
          <label className="remember">
            <input
              type="checkbox"
              checked={pwPersistent}
              onChange={(e) => setPwPersistent(e.target.checked)}
            />
            このブラウザに記憶する
          </label>
          {pwError && <p className="error">{pwError}</p>}
          <button type="submit" className="primary">
            開く
          </button>
        </form>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>日報</h1>
        <nav>
          <a href="#/" className={route === "today" ? "on" : ""}>今日</a>
          <a href="#/archive" className={route === "archive" ? "on" : ""}>アーカイブ</a>
          <a href="#/edit" className={route === "editor" ? "on" : ""}>編集</a>
          {load.kind === "encrypted" && (
            <button className="lock-btn" onClick={handleForget} title="パスワードを忘れる">
              🔒
            </button>
          )}
        </nav>
      </header>
      <main>
        {route === "today" ? (
          <Today data={data} />
        ) : route === "archive" ? (
          <Archive data={data} />
        ) : (
          <Editor initial={data} currentPassword={password} encrypted={load.kind === "encrypted"} />
        )}
      </main>
    </div>
  );
}
