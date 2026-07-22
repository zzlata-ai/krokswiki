<template lang='pug'>
  v-app
    v-container.welcome-container(fluid)
      .text-center.my-10
        h1.display-1.font-weight-bold.mb-3 База знаний
        p.title.grey--text.text--darken-1 Выберите интересующий вас раздел

      v-row(v-if='loading', justify='center')
        v-col(cols='12', class='text-center')
          v-progress-circular(indeterminate, color='primary', size='64')
          p.mt-4 Загрузка разделов...

      v-row(v-else, justify='center')
        v-col(
          v-for='(section, index) in sections',
          :key='index',
          cols='12', sm='6', md='4', lg='3'
        )
          v-card.section-card(hover, height='100%')
            // Заголовок карточки - ссылка на раздел
            a.section-title-link(:href='section.path', @click.prevent='navigateToSection(section.path)')
              v-card-title
                .headline {{ section.title }}

            v-card-text
              div(v-if='section.children && section.children.length > 0')
                v-divider.mb-2
                .subtitle-2.font-weight-bold.mb-2 Содержимое:

                v-list(dense, nav, class='pa-0')
                  v-list-item(
                    v-for='(child, idx) in section.children.slice(0, 6)',
                    :key='child.path',
                    :href='child.path',
                    @click.prevent='navigateToSection(child.path)',
                    class='child-link'
                  )
                    v-list-item-icon.mt-1
                      v-icon(small, :color='child.hasChildren ? "warning" : "primary"')
                        | {{ child.hasChildren ? 'mdi-folder' : 'mdi-file-document' }}
                    v-list-item-title {{ child.title }}

                div.mt-2.text-right(v-if='section.children.length > 6')
                  span.text-caption.grey--text И ещё {{ section.children.length - 6 }}...

              em.grey--text(v-else)
                | Перейти в раздел

            v-card-actions
              v-spacer
              a(:href='section.path', @click.prevent='navigateToSection(section.path)')
                v-btn(icon, color='primary')
                  v-icon mdi-arrow-right

      v-row(v-if='!loading && sections.length === 0', justify='center')
        v-col(cols='12', class='text-center')
          v-alert(type='error', outlined)
            | Разделы не найдены.
            br
            | Проверьте консоль браузера (F12) на наличие ошибок.
</template>

<script>
export default {
  props: {
    locale: {
      type: String,
      default: 'ru'
    }
  },

  data() {
    return {
      sections: [],
      loading: true
    }
  },

  async created() {
    await this.loadSections()
  },

  methods: {
    async loadSections() {
      this.loading = true

      try {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query {
              pages {
                list(limit: 500) {
                  id
                  path
                  title
                }
              }
            }`
          })
        })

        const result = await response.json()

        if (result.errors) {
          console.error('[HomePage] Ошибки GraphQL:', result.errors)
        }

        const allPages = result.data?.pages?.list || []
        const sectionsMap = new Map()

        allPages.forEach(page => {
          if (!page.path) return

          const cleanPath = page.path.replace(/^\/+/, '')
          const parts = cleanPath.split('/').filter(Boolean)

          if (parts.length === 0) return

          const rootSlug = parts[0]
          const rootPath = '/' + rootSlug

          if (!sectionsMap.has(rootPath)) {
            const fallbackTitle = rootSlug
              .replace(/-/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase())

            sectionsMap.set(rootPath, {
              path: rootPath,
              title: fallbackTitle,
              children: [],
              addedPaths: new Set()
            })
          }

          const section = sectionsMap.get(rootPath)

          if (parts.length === 1) {
            section.title = page.title
          } else {
            let childPath, childTitle, childId, hasChildren

            if (parts.length === 2) {
              childPath = page.path.startsWith('/') ? page.path : '/' + page.path
              childTitle = page.title
              childId = page.id
              hasChildren = false
            } else {
              const subPath = parts[0] + '/' + parts[1]
              childPath = '/' + subPath

              const subSectionPage = allPages.find(p => {
                const cleanP = p.path.replace(/^\/+/, '')
                return cleanP === subPath
              })

              if (subSectionPage) {
                childTitle = subSectionPage.title
                childId = subSectionPage.id
                hasChildren = true
              } else {
                childTitle = parts[1]
                  .replace(/-/g, ' ')
                  .replace(/\b\w/g, l => l.toUpperCase())
                childId = null
                hasChildren = true
              }
            }

            if (!section.addedPaths.has(childPath)) {
              section.addedPaths.add(childPath)
              section.children.push({
                id: childId,
                path: childPath,
                title: childTitle,
                hasChildren: hasChildren
              })
            }
          }
        })

        sectionsMap.forEach(section => {
          section.children.forEach(child => {
            const hasChildPages = allPages.some(p => {
              const cleanP = p.path.replace(/^\/+/, '')
              const parts = cleanP.split('/').filter(Boolean)
              if (parts.length < 3) return false

              const childCleanPath = child.path.replace(/^\/+/, '')
              return parts[0] + '/' + parts[1] === childCleanPath
            })

            if (hasChildPages) {
              child.hasChildren = true
            }
          })
        })

        this.sections = Array.from(sectionsMap.values()).map(section => {
          delete section.addedPaths
          section.children.sort((a, b) => {
            if (a.hasChildren !== b.hasChildren) {
              return a.hasChildren ? -1 : 1
            }
            return a.title.localeCompare(b.title, 'ru')
          })
          return section
        })

        this.sections.sort((a, b) => a.title.localeCompare(b.title, 'ru'))

        console.log('[HomePage] Разделы:', this.sections)
      } catch (error) {
        console.error('[HomePage] Ошибка:', error)
      } finally {
        this.loading = false
      }
    },

    navigateToSection(path) {
      console.log('[HomePage] Переход:', path)
      window.location.href = path
    }
  }
}
</script>

<style lang='scss' scoped>
.welcome-container {
  max-width: 1200px;
  margin: 0 auto;
}

.section-card {
  height: 100%;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0,0,0,0.15) !important;
  }

  .v-card__text {
    flex-grow: 1;
  }
}

.section-title-link {
  text-decoration: none;
  color: inherit;
  display: block;

  &:hover {
    .headline {
      color: var(--v-primary-base);
    }
  }
}

.child-link {
  border-radius: 4px;
  transition: background-color 0.2s ease;
  text-decoration: none;
  color: inherit;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }
}
</style>
