<template lang="pug">
  //- Если у узла есть дети, рендерим его как раскрывающуюся группу
  v-list-group(
    v-if='node.children && node.children.length > 0'
    :key='node.path'
    v-model='isOpen'
    :group='node.path'
    no-action
    :sub-group='depth > 0'
  )
    template(v-slot:activator)
      v-list-item-title.nav-title {{ node.title }}
      v-spacer
      v-icon.arrow-icon(small)
        | {{ isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}

    //- РЕКУРСИЯ: вызываем этот же компонент для каждого ребенка
    nav-tree-item(
      v-for='child in node.children'
      :key='child.path'
      :node='child'
      :depth='depth + 1'
      :current-path='currentPath'
    )

  //- Если детей нет, рендерим как обычную ссылку на статью
  v-list-item(
    v-else
    :key='node.path'
    :href='node.path'
    :class='{ "v-list-item--active": isActive }'
  )
    v-list-item-title.nav-title {{ node.title }}
</template>

<script>
export default {
  name: 'NavTreeItem',
  props: {
    node: {
      type: Object,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    },
    currentPath: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      isOpen: false
    }
  },
  computed: {
    isActive() {
      return this.currentPath === this.node.path || this.currentPath.startsWith(this.node.path + '/')
    }
  },
  watch: {
    isActive(newVal) {
      if (newVal && this.node.children && this.node.children.length > 0) {
        this.isOpen = true
      }
    }
  },
  mounted() {
    // При загрузке открываем все родительские разделы для текущей страницы
    if (this.isActive && this.node.children && this.node.children.length > 0) {
      this.isOpen = true
    }
  }
}
</script>

<style lang="scss" scoped>
.nav-title {
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  line-height: 1.3;
  word-wrap: break-word;
}

.theme--light .nav-title {
  color: #1976D2 !important;
  font-weight: 400 !important;
}

.arrow-icon {
  color: #1976D2 !important;
  opacity: 0.7;
}

/* Скрываем ВСЕ встроенные иконки Vuetify */
::v-deep .v-list-group__header__append-icon,
::v-deep .v-list-group__header__prepend-icon {
  display: none !important;
}

/* Убираем фон у всех элементов кроме активных */
::v-deep .v-list-group__header,
::v-deep .v-list-item {
  background-color: transparent !important;
}
</style>
