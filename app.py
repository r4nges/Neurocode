"""
NeuroCode · Backend (Flask)
============================
Servidor leve que entrega o site estático e expõe uma pequena API "conectiva":

    GET  /                -> index.html
    GET  /api/cursos      -> lista de trilhas (data/cursos.json)
    POST /api/neurobot    -> resposta do assistente NeuroBot (rule-based)
    POST /api/inscricao   -> registra um e-mail (data/inscricoes.json)

O front-end funciona mesmo SEM este backend (os módulos JS têm fallback local).
Com o backend ativo, os dados passam a vir do Python — é o "conectivo" do projeto.

Como rodar:
    pip install -r requirements.txt
    python app.py
    # abra http://127.0.0.1:5000
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

CURSOS_FILE = DATA_DIR / "cursos.json"
INSCRICOES_FILE = DATA_DIR / "inscricoes.json"

app = Flask(__name__, static_folder="static", static_url_path="/static")


# --------------------------------------------------------------------------- #
# Páginas
# --------------------------------------------------------------------------- #
@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def root_files(filename: str):
    """Serve arquivos soltos da raiz (logo.svg, favicon, etc.) com segurança."""
    target = (BASE_DIR / filename).resolve()
    if BASE_DIR in target.parents and target.is_file():
        return send_from_directory(BASE_DIR, filename)
    return jsonify(erro="não encontrado"), 404


# --------------------------------------------------------------------------- #
# API · Cursos
# --------------------------------------------------------------------------- #
@app.get("/api/cursos")
def api_cursos():
    try:
        data = json.loads(CURSOS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        data = {"cursos": []}
    nivel = request.args.get("nivel")
    if nivel and nivel != "todos":
        data["cursos"] = [c for c in data["cursos"] if c.get("level") == nivel]
    return jsonify(data)


# --------------------------------------------------------------------------- #
# API · NeuroBot (assistente rule-based)
# --------------------------------------------------------------------------- #
BOT_KNOWLEDGE = [
    (["ola", "oi", "bom dia", "boa tarde", "boa noite", "eai", "e ai"],
     "Olá! 👋 Eu sou o <b>NeuroBot</b>, seu assistente de estudos. Posso explicar "
     "conceitos, recomendar uma trilha ou tirar dúvidas. Sobre o que quer falar?"),
    (["python"],
     "Python é uma ótima primeira linguagem: sintaxe limpa e legível. Declarar uma "
     "variável é só <code>nome = \"Ana\"</code>. A trilha <b>Python Completo</b> tem "
     "88 aulas, do zero à automação."),
    (["javascript", "js"],
     "JavaScript é a linguagem do navegador — é ela que torna as páginas interativas. "
     "Na trilha <b>JavaScript Moderno</b> você aprende ES6+, DOM e APIs."),
    (["html", "css", "web", "site"],
     "Para a web começamos com <b>HTML</b> (estrutura) e <b>CSS</b> (estilo), depois "
     "<b>JavaScript</b> (interação). A trilha <b>Desenvolvimento Web</b> leva você do "
     "zero até publicar um site responsivo. 🚀"),
    (["variavel", "variaveis"],
     "Uma variável é um espaço nomeado para guardar um valor. Em Python: "
     "<code>idade = 25</code>. É um dos primeiros tópicos da trilha de Python!"),
    (["trilha", "curso", "comecar", "iniciante", "do zero"],
     "Temos trilhas para todos os níveis: <b>Web Dev</b> e <b>Python</b> (iniciante), "
     "<b>JavaScript</b> e <b>PHP</b> (intermediário), <b>Estrutura de Dados</b> e "
     "<b>Algoritmos</b> (avançado). Faça o quiz de perfil e eu recomendo a ideal. 🎯"),
    (["xp", "nivel", "gamific", "ranking", "conquista", "streak", "sequencia"],
     "A gamificação te mantém no ritmo: ganha <b>XP</b> por aula, sobe de <b>nível</b>, "
     "desbloqueia <b>conquistas</b>, mantém a <b>sequência</b> 🔥 e disputa o "
     "<b>ranking</b>. Aprender vira um jogo!"),
    (["preco", "plano", "valor", "quanto custa", "gratis", "free"],
     "Temos o plano <b>Explorar</b> (grátis), o <b>Pro</b> (R$39/mês, recomendado) e o "
     "<b>Carreira</b> (R$89/mês, com mentoria 1:1 semanal)."),
    (["mentoria", "mentor", "carlos"],
     "Na mentoria você conversa com profissionais como o <b>Carlos Silva</b>, dev "
     "full-stack sênior, que ajudam com carreira e revisão de projetos. 👨‍🏫"),
    (["certificado", "diploma"],
     "Sim! Ao concluir uma trilha você recebe um <b>certificado digital</b> com carga "
     "horária, válido para processos seletivos. 📜"),
    (["obrigado", "obrigada", "valeu", "vlw", "tchau"],
     "Por nada! 😄 Bons estudos — <i>seu cérebro, seu ritmo, seu código.</i>"),
]

BOT_FALLBACK = (
    "Boa pergunta! 🤔 Posso ajudar com <b>trilhas</b>, <b>linguagens</b> "
    "(Python, JavaScript, Web), <b>gamificação</b>, <b>planos</b> e <b>mentoria</b>. "
    "Tente, por exemplo: \"como começo do zero?\""
)


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


@app.post("/api/neurobot")
def api_neurobot():
    payload = request.get_json(silent=True) or {}
    msg = _normalize(str(payload.get("mensagem", "")))
    for keys, reply in BOT_KNOWLEDGE:
        if any(_normalize(k) in msg for k in keys):
            return jsonify(resposta=reply)
    return jsonify(resposta=BOT_FALLBACK)


# --------------------------------------------------------------------------- #
# API · Inscrição / newsletter
# --------------------------------------------------------------------------- #
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@app.post("/api/inscricao")
def api_inscricao():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip()
    if not EMAIL_RE.match(email):
        return jsonify(ok=False, mensagem="E-mail inválido."), 400

    registro = {
        "email": email,
        "origem": str(payload.get("origem", "site")),
        "em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    try:
        registros = json.loads(INSCRICOES_FILE.read_text(encoding="utf-8"))
        if not isinstance(registros, list):
            registros = []
    except (OSError, json.JSONDecodeError):
        registros = []
    registros.append(registro)
    INSCRICOES_FILE.write_text(
        json.dumps(registros, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return jsonify(
        ok=True,
        mensagem=f"Tudo certo! Enviamos as próximas aulas para {email} 🎉",
    )


# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    print("NeuroCode rodando em http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
