<template>
  <div class="custom-wiki-theme">
    <!-- === ЛОГИКА ГЛАВНОЙ СТРАНИЦЫ === -->
    <article v-if="isSection" class="section-view">
      <div class="container">
        <div class="card">
          <div class="card-header">
            <span class="icon">📖</span>
            <h1>Добро пожаловать в Wiki</h1>
          </div>
          <div class="card-content">
            <p class="subtitle">Выберите раздел из списка ниже:</p>

            <div class="section-list">
              <div v-for="(subpage, index) in sectionPages" :key="subpage.path" class="section-item">
                <a :href="'/' + subpage.path" class="section-link">
                  <span class="icon">
                    <span v-if="subpage.isFolder">📁</span>
                    <span v-else>📄</span>
                  </span>
                  <span class="title">{{ subpage.title }}</span>
                  <span class="path">{{ subpage.path }}</span>
                </a>
                <hr v-if="index < sectionPages.length - 1">
              </div>
            </div>

            <div v-if="sectionPages.length === 0" class="alert">
              <p>В этом разделе пока нет статей или подразделов.</p>
            </div>
          </div>
        </div>
      </div>
    </article>

    <!-- === СТАНДАРТНЫЙ ЭКРАН === -->
    <div v-else class="welcome-screen">
      <div class="container">
        <h1 class="logo">Wiki.js</h1>
        <p>Welcome to your wiki!</p>
        <p>Let's get started and create the home page.</p>
        <div class="buttons">
          <a href="/e/en/home" class="btn primary">+ CREATE HOME PAGE</a>
          <a href="/admin" class="btn secondary"> ADMINISTRATION</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isSection: false,
      sectionPages: []
    }
  },
  async mounted() {
    await this.checkIfSection()
  },
  methods: {
    async checkIfSection() {
      try {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query { pages { list(locale: "en", limit: 200) { id path title } } }`
          })
        })

        if (response.status === 200) {
          const result = await response.json()

          if (result.data && result.data.pages && result.data.pages.list) {
            const allPages = result.data.pages.list
            // Фильтруем только разделы верхнего уровня
            const topLevelPages = allPages.filter(p => {
              const pathParts = p.path.split('/')
              return pathParts.length === 1 && p.path !== 'home'
            })

            if (topLevelPages.length > 0) {
              this.isSection = true
              this.sectionPages = topLevelPages.map(p => ({
                title: p.title || p.path,
                path: p.path,
                isFolder: false
              }))
            }
          }
        }
      } catch (e) {
        console.error('Ошибка при проверке разделов:', e)
      }
    }
  }
}
</script>

<style scoped>
.custom-wiki-theme {
  min-height: 100vh;
  padding: 20px;
}

.section-view, .welcome-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
}

.container {
  max-width: 800px;
  width: 100%;
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.card-header {
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header h1 {
  margin: 0;
  font-size: 24px;
}

.card-content {
  padding: 20px;
}

.subtitle {
  color: #666;
  margin-bottom: 20px;
}

.section-list {
  margin-top: 20px;
}

.section-item {
  margin-bottom: 10px;
}

.section-link {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}

.section-link:hover {
  background: #e0e0e0;
  transform: translateY(-2px);
}

.icon {
  font-size: 24px;
}

.title {
  flex: 1;
  font-weight: 500;
}

.path {
  color: #999;
  font-size: 14px;
}

hr {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 10px 0;
}

.alert {
  padding: 20px;
  background: #e3f2fd;
  border-radius: 8px;
  text-align: center;
  color: #1976d2;
}

.logo {
  font-size: 48px;
  margin-bottom: 20px;
}

.buttons {
  display: flex;
  gap: 15px;
  margin-top: 30px;
  justify-content: center;
}

.btn {
  padding: 12px 24px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
}

.btn.primary {
  background: #2196f3;
  color: white;
}

.btn.primary:hover {
  background: #1976d2;
}

.btn.secondary {
  background: transparent;
  color: #2196f3;
  border: 2px solid #2196f3;
}

.btn.secondary:hover {
  background: #e3f2fd;
}
</style>
