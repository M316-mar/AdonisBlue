(function() {
  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  
  var slug = script.getAttribute('data-bot-slug');
  if (!slug) return;

  // Create chat bubble
  var bubble = document.createElement('div');
  bubble.id = 'adonisblue-bubble';
  bubble.innerHTML = '💬';
  bubble.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:#0d9488;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:24px;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:99999;transition:transform 0.2s;';
  bubble.onmouseenter = function() { bubble.style.transform = 'scale(1.1)'; };
  bubble.onmouseleave = function() { bubble.style.transform = 'scale(1)'; };

  // Create iframe container
  var container = document.createElement('div');
  container.id = 'adonisblue-container';
  container.style.cssText = 'posion:fixed;bottom:90px;right:24px;width:380px;height:600px;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.2);z-index:99998;display:none;';
  
  var iframe = document.createElement('iframe');
  iframe.src = 'https://www.adonisblue.io/chat/' + slug;
  iframe.style.cssText = 'width:100%;height:100%;border:none;';
  container.appendChild(iframe);

  var open = false;
  bubble.onclick = function() {
    open = !open;
    container.style.display = open ? 'block' : 'none';
    bubble.innerHTML = open ? '✕' : '💬';
  };

  document.body.appendChild(bubble);
  document.body.appendChild(container);
})();
