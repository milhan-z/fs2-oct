import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Loading speed, in two parts that both start from index.html instead of waiting for the JavaScript:
 *  - the fonts of the first screens are preloaded (they are otherwise requested only after the app has rendered);
 *  - in Supabase mode the first data requests (content, and the passport state when a session exists) leave while
 *    the bundle downloads. src/data/supabaseAdapter.ts picks the answers up from window.__fs2early.
 */
function earlyBoot(env: Record<string, string>): Plugin {
  const live = env.VITE_DATA_MODE === 'supabase' && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
  return {
    name: 'fs2-early-boot',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const tags: HtmlTagDescriptor[] = []
        for (const file of Object.keys(ctx.bundle ?? {})) {
          if (!/(poppins-latin-(400|600)-normal|libre-baskerville-latin-700-normal)[^/]*\.woff2$/.test(file)) continue
          tags.push({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${file}`, crossorigin: '' }, injectTo: 'head' })
        }
        if (live) {
          const origin = new URL(env.VITE_SUPABASE_URL).origin
          tags.push({ tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head-prepend' })
          tags.push({
            tag: 'script',
            injectTo: 'head',
            children: `(function(){try{var u=${JSON.stringify(origin)},k=${JSON.stringify(env.VITE_SUPABASE_ANON_KEY)};
var call=function(fn,b){return fetch(u+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.ok?r.text():Promise.reject(r.status)})};
var e=window.__fs2early={t:Date.now(),tok:null};
e.content=call('get_content',{});e.content.catch(function(){});
var tok=localStorage.getItem('fs2.session.participant');
if(tok&&location.pathname.indexOf('/staff')!==0&&location.pathname.indexOf('/admin')!==0){e.tok=tok;e.state=call('get_my_state',{p_token:tok});e.state.catch(function(){})}
}catch(_){}})()`,
          })
        }
        return tags
      },
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), earlyBoot(loadEnv(mode, process.cwd(), 'VITE_'))],
  server: { host: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          motion: ['motion/react'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
}))
