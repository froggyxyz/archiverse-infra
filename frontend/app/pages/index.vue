<script setup lang="ts">
definePageMeta({
  layout: 'landing',
  auth: 'optional',
})

const { user } = useAuthTokens()
const { createAndGo } = useCreateRoom()
</script>

<template>
  <div class="landing">
    <section class="landing__hero">
      <p class="landing__label">
        Асоциальная сеть
      </p>
      <h1 class="landing__title">
        ARCHIVERSE
      </h1>
      <p class="landing__tagline">
        Комнаты. Плейлисты. Без ленты, лайков и подписчиков.
      </p>
    </section>

    <section class="landing__concept">
      <p class="landing__concept-line">
        Контент и контекст важнее людей.
      </p>
      <p class="landing__concept-line">
        Заходи в комнату — смотри и слушай вместе или один. Никакой геймификации и метрик.
      </p>
      <p class="landing__concept-line">
        Приватно, по желанию, без обязательств.
      </p>
    </section>

    <section class="landing__cta">
      <UiButton
        size="lg"
        class="landing__btn landing__btn--primary"
        @click="createAndGo"
      >
        Создать комнату
      </UiButton>
      <NuxtLink
        v-if="!user"
        to="/login"
        class="landing__link"
      >
        Войти
      </NuxtLink>
      <NuxtLink
        v-else
        :to="user ? `/profile/${encodeURIComponent(user.username)}` : '/'"
        class="landing__link"
      >
        В профиль
      </NuxtLink>
    </section>

    <footer class="landing__footer">
      <p class="landing__footer-text">
        Место, куда приходят по действию, а не по графу друзей.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(2rem, 6vw, 4rem) 1.5rem clamp(3rem, 8vw, 5rem);
  text-align: center;
}

.landing__hero {
  margin-bottom: clamp(2.5rem, 8vw, 4rem);
}

.landing__label {
  font-size: clamp(0.75rem, 2vw, 0.875rem);
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.landing__title {
  font-size: clamp(2.5rem, 10vw, 4.5rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.1;
  color: var(--text-color);
  margin: 0 0 1rem;
}

.landing__tagline {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: var(--text-secondary);
  max-width: 28ch;
  margin: 0 auto;
  line-height: 1.5;
}

.landing__concept {
  max-width: 36rem;
  margin-bottom: clamp(2.5rem, 8vw, 4rem);
  padding: 0 0.5rem;
}

.landing__concept-line {
  font-size: clamp(0.9375rem, 1.8vw, 1.0625rem);
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0 0 0.75rem;
}

.landing__concept-line:last-child {
  margin-bottom: 0;
}

.landing__cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: clamp(2.5rem, 6vw, 3.5rem);
}

.landing__btn {
  min-width: 200px;
}

.landing__cta .landing__btn--primary {
  background-color: var(--accent-color);
  color: var(--text-color);
}

.landing__cta .landing__btn--primary:hover {
  filter: brightness(1.1);
}

.landing__link {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  text-decoration: none;
}

.landing__link:hover {
  color: var(--text-color);
}

.landing__footer {
  margin-top: auto;
  padding-top: 2rem;
  border-top: 1px solid var(--bg-secondary);
}

.landing__footer-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0;
  max-width: 24ch;
}
</style>
