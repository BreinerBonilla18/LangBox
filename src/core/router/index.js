import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../../layouts/Layout.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('../../views/HomeView.vue')
      },
      {
        path: 'search/:word',
        name: 'search',
        component: () => import('../../views/SearchView.vue'),
        props: true
      },
      {
        path: 'vocabulary',
        name: 'vocabulary',
        component: () => import('../../views/VocabularyView.vue')
      },
      {
        path: 'flashcards',
        name: 'flashcards',
        component: () => import('../../views/FlashcardsView.vue')
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('../../views/NotFoundView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
