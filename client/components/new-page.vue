<template lang='pug'>
  v-app
    // === ЛОГИКА РАЗДЕЛА ===
    .section-view(v-if='isSection')
      v-container.pl-5.pt-4(fluid, grid-list-xl)
        v-layout(row)
          v-flex(xs12)
            v-card.mb-5.elevation-1
              v-card-title.headline
                v-icon.mr-3(color='orange') mdi-folder-open
                span Раздел: {{ sectionTitle }}
              v-card-text
                p.grey--text.mb-4 Выберите подраздел или статью из списка:

                v-list(two-line, rounded, tile)
                  template(v-for='(subpage, index) in sectionPages')
                    v-list-item(
                      :key='subpage.path'
                      :href='`/${subpage.path}`'
                      style='text-decoration: none; color: inherit; border-radius: 8px; margin-bottom: 8px; transition: background 0.2s;'
                    )
                      v-list-item-avatar
                        v-icon(:color='subpage.isFolder ? "orange" : "blue"') {{ subpage.isFolder ? "mdi-folder" : "mdi-file-document-outline" }}
                      v-list-item-content
                        v-list-item-title(:class='$vuetify.theme.dark ? "white--text" : "grey--text text--darken-4"') {{ subpage.title }}
                        v-list-item-subtitle {{ subpage.path }}
                    v-divider(v-if='index < sectionPages.length - 1')

                v-alert(v-if='sectionPages.length === 0', type='info', text, outlined)
                  | В этом разделе пока нет статей или подразделов.

    // === СТАНДАРТНЫЙ ЭКРАН СОЗДАНИЯ СТРАНИЦЫ ===
    .newpage(v-else-if='!isLoading')
      .newpage-content
        img.animated.fadeIn(src='/_assets/svg/icon-delete-file.svg', alt='Not Found')
        .headline {{ $t('newpage.title') }}
        .subtitle-1.mt-3 {{ $t('newpage.subtitle') }}
        v-btn.mt-5(:href='`/e/` + locale + `/` + path', x-large)
          v-icon(left) mdi-plus
          span {{ $t('newpage.create') }}
        v-btn.mt-5(color='purple lighten-3', href='javascript:window.history.go(-1);', outlined)
          v-icon(left) mdi-arrow-left
          span {{ $t('newpage.goback') }}
</template>

<script>
export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    }
  },
  data() {
    return {
      isSection: false,
      sectionPages: [],
      isLoading: true
    }
  },
  computed: {
    sectionTitle() {
      const parts = this.path.split('/').filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1].replace(/-/g, ' ') : 'Раздел'
    }
  },
  async created() {
    await this.checkIfSection()
  },
  methods: {
    async checkIfSection() {
      const currentPath = this.path.replace(/^\//, '').replace(/\/$/, '')
      console.log('Проверка раздела:', currentPath, 'locale:', this.locale)

      if (!currentPath || currentPath === 'home') {
        this.isLoading = false
        return
      }

      try {
        // GraphQL запрос к правильному endpoint
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query { pages { list(locale: "${this.locale}", limit: 200) { id path title } } }`
          })
        })

        if (response.status === 200) {
          const result = await response.json()

          if (result.data && result.data.pages && result.data.pages.list) {
            const allPages = result.data.pages.list
            console.log('Все страницы из API:', allPages)

            // Ищем страницы, путь которых начинается с текущего path
            // ВАЖНО: в базе пути БЕЗ префикса locale, просто "antenny/..."
            const searchPrefix = currentPath + '/'
            const childPages = allPages.filter(p => p.path.startsWith(searchPrefix))

            console.log('Найдено дочерних страниц:', childPages.length)

            if (childPages.length > 0) {
              this.isSection = true
              this.sectionPages = childPages.map(p => ({
                title: p.title || p.path.split('/').pop().replace(/-/g, ' '),
                path: p.path, // путь уже правильный, без /en/
                isFolder: false
              }))
              console.log('✅ Раздел найден! Показываем список.')
            }
          }
        } else {
          console.error('GraphQL ответил с ошибкой:', response.status)
        }
      } catch (e) {
        console.error('❌ Ошибка при проверке раздела:', e)
      } finally {
        this.isLoading = false
      }
    }
  }
}
</script>

<style lang='scss'>
.section-view {
  min-height: 100vh;
  padding-top: 64px;
}
</style>
