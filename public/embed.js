(function () {
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var slug = script.getAttribute('data-bot-slug');
  if (!slug) return;

  var PRIMARY = '#0d9488';
  var open = false;

  // Fetch bot info to get practice name, color, attention message
  fetch('https://www.adonisblue.io/api/bot/' + slug)
    .then(function (r) { return r.json(); })
    .then(function (bot) {
      var color = bot.primary_color || PRIMARY;
      var name = bot.practice_name || bot.bot_name || 'Chat with us';
      var attention = bot.bubble_attention_message || 'Need help? Chat with us 💬';
      var logo = bot.logo_image || bot.logo_data_url || null;

      // ── Styles ──────────────────────────────────────────────
      var style = document.createElement('style');
      style.textContent = [
        '#ab-launcher{position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column;align-items:flex-end;gap:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
        '#ab-attention{background:#fff;border-radius:16px;padding:10px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.13);font-size:13px;font-weight:500;color:#1a2744;max-width:220px;text-align:right;line-height:1.4;cursor:pointer;border:1.5px solid #e2e8f0;transition:opacity 0.2s;}',
        '#ab-attention:hover{opacity:0.85;}',
        '#ab-bubble{display:flex;align-items:center;gap:10px;background:#fff;border-radius:50px;padding:10px 18px 10px 10px;box-shadow:0 4px 24px rgba(0,0,0,0.15);cursor:pointer;border:1.5px solid #e2e8f0;transition:transform 0.2s,box-shadow 0.2s;}',
        '#ab-bubble:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.18);}',
        '#ab-bubble-icon{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}',
        '#ab-bubble-icon img{width:38px;height:38px;border-radius:50%;object-fit:cover;}',
        '#ab-bubble-text{display:flex;flex-direction:column;}',
        '#ab-bubble-name{font-size:13px;font-weight:600;color:#1a2744;line-height:1.2;}',
        '#ab-bubble-status{font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px;margin-top:2px;}',
        '#ab-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;}',
        '#ab-container{position:fixed;bottom:100px;right:24px;width:390px;height:620px;z-index:99998;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,0.18);display:none;transform:translateY(16px);opacity:0;transition:transform 0.25s ease,opacity 0.25s ease;border:1.5px solid #e2e8f0;}',
        '#ab-container.ab-open{display:block;}',
        '#ab-container.ab-visible{transform:translateY(0);opacity:1;}',
        '@media(max-width:480px){#ab-container{width:calc(100vw - 16px);height:calc(100dvh - 80px);right:8px;bottom:76px;border-radius:16px;}}',
      ].join('');
      document.head.appendChild(style);

      // ── Attention chip ──────────────────────────────────────
      var attn = document.createElement('div');
      attn.id = 'ab-attention';
      attn.textContent = attention;
      attn.onclick = toggleChat;

      // ── Bubble ─────────────────────────────────────────────
      var bubble = document.createElement('div');
      bubble.id = 'ab-bubble';
      bubble.onclick = toggleChat;

      var icon = document.createElement('div');
      icon.id = 'ab-bubble-icon';
      icon.style.background = color + '22';
      if (logo) {
        var img = document.createElement('img');
        img.src = logo;
        img.alt = name;
        icon.appendChild(img);
      } else {
        icon.style.background = color;
        icon.innerHTML = '<span style="color:#fff;font-size:18px;">💬</span>';
      }

      var textWrap = document.createElement('div');
      textWrap.id = 'ab-bubble-text';

      var nameEl = document.createElement('div');
      nameEl.id = 'ab-bubble-name';
      nameEl.textContent = name;

      var statusEl = document.createElement('div');
      statusEl.id = 'ab-bubble-status';
      statusEl.innerHTML = '<span id="ab-dot"></span> Online now';

      textWrap.appendChild(nameEl);
      textWrap.appendChild(statusEl);
      bubble.appendChild(icon);
      bubble.appendChild(textWrap);

      // ── Launcher wrapper ────────────────────────────────────
      var launcher = document.createElement('div');
      launcher.id = 'ab-launcher';
      launcher.appendChild(attn);
      launcher.appendChild(bubble);

      // ── iframe container ────────────────────────────────────
      var container = document.createElement('div');
      container.id = 'ab-container';

      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.adonisblue.io/chat/' + slug;
      iframe.style.cssText = 'width:100%;height:100%;border:none;';
      iframe.allow = 'clipboard-write';
      container.appendChild(iframe);

      document.body.appendChild(container);
      document.body.appendChild(launcher);

      // ── Toggle ──────────────────────────────────────────────
      function toggleChat() {
        open = !open;
        if (open) {
          attn.style.display = 'none';
          container.classList.add('ab-open');
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              container.classList.add('ab-visible');
            });
          });
        } else {
          container.classList.remove('ab-visible');
          setTimeout(function () { container.classList.remove('ab-open'); }, 250);
          attn.style.display = 'block';
        }
      }

      // Close when clicking outside on mobile
      document.addEventListener('click', function (e) {
        if (open && !container.contains(e.target) && !launcher.contains(e.target)) {
          toggleChat();
        }
      });
    })
    .catch(function () {
      // Fallback plain bubble if API fails
      var fb = document.createElement('div');
      fb.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:' + PRIMARY + ';border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:99999;';
      fb.innerHTML = '💬';
      var fc = document.createElement('div');
      fc.style.cssText = 'position:fixed;bottom:90px;right:24px;width:380px;height:600px;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.2);z-index:99998;display:none;';
      var fi = document.createElement('iframe');
      fi.src = 'https://www.adonisblue.io/chat/' + slug;
      fi.style.cssText = 'width:100%;height:100%;border:none;';
      fc.appendChild(fi);
      var fo = false;
      fb.onclick = function () { fo = !fo; fc.style.display = fo ? 'block' : 'none'; fb.innerHTML = fo ? '✕' : '💬'; };
      document.body.appendChild(fb);
      document.body.appendChild(fc);
    });
})();
