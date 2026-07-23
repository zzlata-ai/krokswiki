<template lang="pug">
  v-list.nav-sidebar(nav, :color='color', expand)
    nav-tree-item(
      v-for='node in globalNavTree'
      :key='node.path'
      :node='node'
      :depth='0'
      :current-path='currentPath'
    )
</template>

<script>
import NavTreeItem from './nav-tree-item.vue'

export default {
  components: {
    NavTreeItem
  },
  props: {
    items: {
      type: Array,
      default: () => []
    },
    color: {
      type: String,
      default: 'white'
    }
  },
  data() {
    return {
      globalNavTree: [],
      currentPath: window.location.pathname
    }
  },
  async created() {
    await this.buildGlobalTree()
  },
  methods: {
    async buildGlobalTree() {
      try {
        const response = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query GetPages {
              pages {
                list(limit: 5000) {
                  id
                  path
                  title
                }
              }
            }`
          })
        })

        if (!response.ok) {
          throw new Error(`GraphQL error: ${response.status}`)
        }

        const result = await response.json()
        if (result.errors) {
          throw new Error('GraphQL errors')
        }

        const allPages = result.data?.pages?.list || []
        this.globalNavTree = this.buildTreeStructure(allPages)
      } catch (e) {
        console.error('Ошибка при построении дерева навигации:', e)
        this.globalNavTree = this.items
      }
    },

    buildTreeStructure(pages) {
      const map = {}
      const tree = []

      pages.forEach(page => {
        if (!page.path || page.path === '/') return

        const parts = page.path.split('/').filter(Boolean)
        let currentPath = ''

        parts.forEach((part, index) => {
          currentPath += '/' + part

          if (!map[currentPath]) {
            const isLast = index === parts.length - 1
            map[currentPath] = {
              path: currentPath,
              title: isLast ? page.title : this.formatTitle(part),
              children: []
            }
          }
        })
      })

      Object.values(map).forEach(node => {
        const parts = node.path.split('/').filter(Boolean)
        if (parts.length === 1) {
          tree.push(node)
        } else {
          const parentPath = '/' + parts.slice(0, -1).join('/')
          if (map[parentPath]) {
            map[parentPath].children.push(node)
          } else {
            tree.push(node)
          }
        }
      })

      Object.values(map).forEach(node => {
        node.isFolder = node.children && node.children.length > 0
      })

      const sortNodes = (nodes) => {
        nodes.sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
          return a.title.localeCompare(b.title, 'ru')
        })
        nodes.forEach(node => {
          if (node.children && node.children.length > 0) {
            sortNodes(node.children)
          }
        })
      }

      sortNodes(tree)
      return tree
    },

    formatTitle(slug) {
      return slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }
}
</script>

<style lang="scss">
/* Стили для светлой темы */
.theme--light .nav-sidebar, html body .theme--light .v-application--wrap nav {
  background-color: #ffffff !important;
  border-right: 1px solid #e0e0e0 !important;

  .v-list-item {
    padding: 12px 16px !important;
    border-radius: 4px !important;
    background-color: transparent !important;

    &:hover {
      background-color: #F5F9FF !important;
    }
  }

  .v-list-item__title {
    color: #1976D2 !important;
    font-weight: 400 !important;
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    line-height: 1.3;
    word-wrap: break-word;
  }

  .v-list-item--active {
    background-color: #E3F2FD !important;

    .v-list-item__title {
      color: #0D47A1 !important;
      font-weight: 600 !important;
    }
  }

  .v-list-group--active > .v-list-group__header {
    background-color: #E3F2FD !important;

    .v-list-item__title {
      color: #0D47A1 !important;
      font-weight: 600 !important;
    }
  }

  .v-list-group__header {
    cursor: pointer;
    background-color: transparent !important;

    .v-list-item__title {
      color: #1976D2 !important;
    }
  }
}

/* Стили для темной темы */
.theme--dark .nav-sidebar {
  .v-list-item {
    padding: 12px 16px !important;
  }

  .v-list-group--active > .v-list-group__header {
    background-color: rgba(255, 255, 255, 0.08);
    .v-list-item__title {
      font-weight: 600;
    }
  }
  .v-list-item--active {
    background-color: rgba(255, 255, 255, 0.12) !important;
    .v-list-item__title {
      font-weight: 600;
    }
  }
  .v-list-group__items {
    transition: all 0.2s ease;
  }
}

/* Общие стили */
.nav-sidebar {
  background-color: #ffffff !important;

  .v-list-item__title {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: clip !important;
    line-height: 1.3;
    word-wrap: break-word;
  }

  .v-list-group__items {
    transition: all 0.2s ease;
  }

  .v-list-group--sub-group {
    .v-list-group__header {
      padding-left: 16px !important;
    }
    .v-list-group__items .v-list-item {
      padding-left: 24px !important;
    }
  }

  /* Скрываем встроенные иконки Vuetify */
  .v-list-group__header__append-icon,
  .v-list-group__header__prepend-icon {
    display: none !important;
  }
}
</style>
