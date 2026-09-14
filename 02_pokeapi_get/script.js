const TOTAL_POKEMON = 1025;
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const API_BASE = "https://pokeapi.co/api/v2/pokemon";

const grid = document.getElementById("grid");
const countEl = document.getElementById("count");
const searchInput = document.getElementById("search");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModal");
const modalContent = document.querySelector(".modal-content");

// APIから返るタイプ名を、画面で使っている元のタイプカラーへ対応させる。
const typeColors = {
  normal: "#A8A878",
  fire: "#F08030",
  water: "#6890F0",
  electric: "#F8D030",
  grass: "#78C850",
  ice: "#98D8D8",
  fighting: "#C03028",
  poison: "#A040A0",
  ground: "#E0C068",
  flying: "#A890F0",
  psychic: "#F85888",
  bug: "#A8B820",
  rock: "#B8A038",
  ghost: "#705898",
  dragon: "#7038F8",
  dark: "#705848",
  steel: "#B8B8D0",
  fairy: "#EE99AC",
};

countEl.textContent = `${TOTAL_POKEMON}匹`;

const nameCache = new Map();

async function fetchAllJapaneseNames() {
  const query = `
    query {
      pokemon_v2_pokemonspeciesname(
        where: {
          language_id: { _eq: 1 }
          pokemon_species_id: { _lte: ${TOTAL_POKEMON} }
        }
      ) {
        name
        pokemon_species_id
      }
    }
  `;
  const res = await fetch("https://beta.pokeapi.co/graphql/v1beta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("Failed to fetch names");
  const json = await res.json();
  const rows = json.data?.pokemon_v2_pokemonspeciesname ?? [];
  for (const row of rows) {
    nameCache.set(row.pokemon_species_id, row.name);
  }
}

function buildGrid() {
  const fragment = document.createDocumentFragment();
  for (let id = 1; id <= TOTAL_POKEMON; id++) {
    const jaName = nameCache.get(id) || "";
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = String(id);
    card.dataset.name = jaName;
    card.innerHTML = `
      <img src="${SPRITE_BASE}/${id}.png" alt="${jaName || `No.${id}`}" loading="lazy">
      <div class="num">No.${String(id).padStart(4, "0")}</div>
      <div class="name">${jaName}</div>
    `;
    card.addEventListener("click", () => openDetail(id));
    fragment.appendChild(card);
  }
  grid.replaceChildren(fragment);
}

async function fetchJapaneseName(id) {
  if (nameCache.has(id)) return nameCache.get(id);
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  const data = await res.json();
  const jaName = data.names.find((n) => n.language.name === "ja-Hrkt" || n.language.name === "ja");
  const result = jaName ? jaName.name : data.name;
  nameCache.set(id, result);
  return result;
}

async function init() {
  grid.innerHTML = `<div class="loading">読み込み中...</div>`;
  try {
    await fetchAllJapaneseNames();
  } catch (err) {
    console.error(err);
  }
  buildGrid();
}

async function openDetail(id) {
  modal.classList.remove("hidden");
  modalContent.style.removeProperty("--type-color-1");
  modalContent.style.removeProperty("--type-color-2");
  modalBody.innerHTML = `<div class="loading">読み込み中...</div>`;
  try {
    const res = await fetch(`${API_BASE}/${id}`);
    const data = await res.json();
    const jaName = await fetchJapaneseName(id);

    const card = grid.querySelector(`.card[data-id="${id}"]`);
    if (card) {
      card.querySelector(".name").textContent = jaName;
      card.dataset.name = jaName;
    }

    const typesHtml = data.types
      .map(
        (t) =>
          `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`
      )
      .join("");

    // タイプの元色を50%白と混ぜ、淡い色にしてモーダルへ渡す。
    const paleTypeColors = data.types.map((type) => {
      const originalColor = typeColors[type.type.name] || "#ffffff";
      return `color-mix(in srgb, ${originalColor}, white 50%)`;
    });
    modalContent.style.setProperty("--type-color-1", paleTypeColors[0]);
    modalContent.style.setProperty(
      "--type-color-2",
      paleTypeColors[1] || paleTypeColors[0]
    );

    // APIから受け取った6種類のステータスを、画面用のHTMLへ変換する。
    const statsHtml = data.stats
      // mapは、ステータス1件ごとに同じ形のHTMLを作る。
      .map(
        (s) => `
          <tr>
            <td colspan="2">
              <!-- タイトルと数値を、バーの上に左右へ分けて表示する。 -->
              <div class="stat-heading">
                <span>${s.stat.name}</span>
                <span class="stat-value">${s.base_stat}</span>
              </div>
              <!-- 外側がバー全体、内側が数値に応じて伸びる部分。 -->
              <div class="stat-bar" role="progressbar" aria-label="${s.stat.name}: ${s.base_stat}" aria-valuemin="1" aria-valuemax="255" aria-valuenow="${s.base_stat}">
                <!-- アニメーション開始前はCSSで幅を0%にしておく。 -->
                <span class="stat-bar-fill" data-value="${s.base_stat}"></span>
              </div>
            </td>
          </tr>`
      )
      // mapで作った各行を、1つのHTML文字列につなげる。
      .join("");

    // 作成したステータスHTMLを、詳細ページのテーブルへ差し込む。
    modalBody.innerHTML = `
      <div class="detail-header">
        <img src="${SPRITE_BASE}/${id}.png" alt="${jaName}">
        <div>
          <h2>${jaName}</h2>
          <div>No.${String(id).padStart(4, "0")}</div>
          <div class="types">${typesHtml}</div>
        </div>
      </div>
      <table class="stats-table">
        <tr><td>身長</td><td>${data.height / 10} m</td></tr>
        <tr><td>体重</td><td>${data.weight / 10} kg</td></tr>
        ${statsHtml}
      </table>
    `;

    // HTMLが画面に描画された次のタイミングで、バーのアニメーションを始める。
    requestAnimationFrame(() => {
      // 6本のバーを1本ずつ取得する。
      modalBody.querySelectorAll(".stat-bar-fill").forEach((fill, index) => {
        // indexを使って、2本目以降の開始を少しずつ遅らせる。
        window.setTimeout(() => {
          // HTML属性に保存していたステータスの数値を、計算用の数値へ変換する。
          const value = Number(fill.dataset.value);
          // 最大値255に対する割合を計算し、バーの幅へ設定する。
          fill.style.width = `${(value / 255) * 100}%`;
        }, index * 90);
      });
    });
  } catch (err) {
    modalBody.innerHTML = `<div class="loading">読み込みに失敗しました。</div>`;
    console.error(err);
  }
}

closeModalBtn.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  document.querySelectorAll(".card").forEach((card) => {
    const id = card.dataset.id;
    const name = (card.dataset.name || "").toLowerCase();
    const matches =
      !query || id === query || id.padStart(4, "0") === query || name.includes(query);
    card.classList.toggle("hidden", !matches);
  });
});

init();
