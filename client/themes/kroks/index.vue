<template>
  <div class="custom-wiki-theme">
    <!-- ========================================== -->
    <!-- БЛОК 1: ОТОБРАЖЕНИЕ СТАТЬИ                 -->
    <!-- ========================================== -->
    <article
      v-if="isArticle"
      class="article-view"
    >
      <h1 class="article-title">
        {{ page.title }}
      </h1>

      <!-- Мета-информация (теги, дата) -->
      <div
        class="article-meta"
        v-if="page.tags && page.tags.length > 0"
      >
        Теги:
        <span
          v-for="tag in page.tags"
          :key="tag"
          class="tag"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Сам контент статьи (рендерится в HTML на бэкенде) -->
      <div
        class="article-body"
        v-html="page.render || page.content"
      />
    </article>

    <!-- ========================================== -->
    <!-- БЛОК 2: ОТОБРАЖЕНИЕ РАЗДЕЛА (ПАПКИ)        -->
    <!-- ========================================== -->
    <section
      v-else-if="isSection"
      class="section-view"
    >
      <h1 class="section-title">
        Раздел: {{ formatPath(currentPath) }}
      </h1>
      <p class="section-description">
        Выберите подраздел или статью из списка:
      </p>

      <!-- Список ссылок на дочерние страницы -->
      <ul
        class="subpages-list"
        v-if="subpages.length > 0"
      >
        <li
          v-for="subpage in subpages"
          :key="subpage.id || subpage.path"
          class="subpage-item"
        >
          <nuxt-link
            :to="subpage.path"
            class="subpage-link"
          >
            <span class="link-icon">📄</span> <!-- Можно менять иконку в зависимости от того, папка это или статья -->
            <span class="link-title">{{ subpage.title }}</span>
            <span class="link-arrow">→</span>
          </nuxt-link>
        </li>
      </ul>

      <!-- Заглушка, если раздел пуст -->
      <div
        v-else
        class="empty-section"
      >
        <p>В этом разделе пока нет статей или подразделов.</p>
      </div>
    </section>

    <!-- Главная страница (опционально) -->
    <div
      v-else
      class="home-view"
    >
      <h1>Добро пожаловать в Wiki</h1>
      <p>Используйте меню слева для навигации.</p>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    // Получаем объект текущей страницы из стора Wiki.js
    page() {
      return this.$store.state.page
    },

    // Текущий URL путь
    currentPath() {
      return this.$route.path
    },

    // Проверка: является ли текущая страница статьёй
    isArticle() {
      // У статьи в Wiki.js всегда есть уникальный id
      return this.page && this.page.id
    },

    // Проверка: является ли текущая страница разделом (папкой)
    isSection() {
      // Если это не статья, но мы не на корневой главной странице
      return !this.isArticle && this.currentPath !== '/'
    },

    // Получаем список дочерних страниц (подразделов и статей) для раздела
    subpages() {
      // Wiki.js автоматически загружает список страниц папки в стор при переходе в неё
      return this.$store.state.pages || []
    }
  },

  methods: {
    // Красивое форматирование пути для заголовка раздела
    formatPath(path) {
      if (!path || path === '/') return 'Главная'
      // Убираем первый слэш и заменяем остальные на пробелы/тире
      return path.replace(/^\//, '').replace(/\//g, ' / ')
    }
  }
}
</script>

<style scoped>
/* === Стили для Статьи === */
.article-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  line-height: 1.6;
}
.article-title {
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
.article-meta {
  margin-bottom: 20px;
  color: #666;
  font-size: 0.9em;
}
.tag {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 5px;
}

/* === Стили для Раздела === */
.section-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
.section-title {
  color: #2c3e50;
  margin-bottom: 10px;
}
.subpages-list {
  list-style: none;
  padding: 0;
  margin-top: 20px;
}
.subpage-item {
  margin-bottom: 10px;
}
.subpage-link {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}
.subpage-link:hover {
  background: #f9f9f9;
  border-color: #3498db;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.05);
}
.link-icon {
  margin-right: 15px;
  font-size: 1.2em;
}
.link-title {
  flex-grow: 1;
  font-weight: 500;
}
.link-arrow {
  color: #3498db;
  font-weight: bold;
}
.empty-section {
  text-align: center;
  color: #888;
  padding: 40px;
  background: #f9f9f9;
  border-radius: 8px;
}
</style>
