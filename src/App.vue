<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { useAuthStore } from "@/stores/auth";

onLaunch(() => {
  console.log("App Launch");
  const auth = useAuthStore();
  auth.restore();
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>

<style lang="scss">
@import "@/styles/global.scss";

/* Each uni-app page is wrapped in <page-meta>. We don't use it here. */
</style>
