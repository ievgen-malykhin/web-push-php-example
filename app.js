document.addEventListener('DOMContentLoaded', () => {
  const applicationServerKey =
      'BGqNWbv0hWM5CQ1-KwAfSQBMC6TMVFyrnh3vQp37oGCNvQ6eG_HyMjxBFJRWeCPTbzDoxcjhxLJS8Ck8r1G2oFw';
  let isPushEnabled = false;

  const pushButton = document.querySelector('#push-button');
  if (!pushButton) {
    return;
  }

  pushButton.addEventListener('click', function () {
    if (isPushEnabled) {
      disablePush();
    } else {
      enablePush();
    }
  });

  const subscriptionButton = document.querySelector('#subscription-button');
  if (!subscriptionButton) {
    return;
  }

  navigator.serviceWorker.register('serviceWorker.js').then(
      () => {
        console.log('[SW] Service worker has been registered');
      },
      e => {
        console.error('[SW] Service worker registration failed', e);
        changePushButtonState('incompatible');
      }
  );

  subscriptionButton.addEventListener('click', async function () {
    let serviceWorkerRegistration = await navigator.serviceWorker.ready;
    let subscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
    })

    push_sendSubscriptionToServer(subscription); // pass subscription here
  });


  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported by this browser');
    changePushButtonState('incompatible');
    return;
  }

  if (!('PushManager' in window)) {
    console.warn('Push notifications are not supported by this browser');
    changePushButtonState('incompatible');
    return;
  }

  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    console.warn('Notifications are not supported by this browser');
    changePushButtonState('incompatible');
    return;
  }

  // Check the current Notification permission.
  // If its denied, the button should appear as such, until the user changes the permission manually
  if (Notification.permission === 'denied') {
    console.warn('Notifications are denied by the user');
    changePushButtonState('incompatible');
  }

  function changePushButtonState(state) {
    switch (state) {
      case 'enabled':
        pushButton.disabled = false;
        pushButton.textContent = 'Disable Push notifications';
        isPushEnabled = true;
        break;
      case 'disabled':
        pushButton.disabled = false;
        pushButton.textContent = 'Enable Push notifications';
        isPushEnabled = false;
        break;
      case 'computing':
        pushButton.disabled = true;
        pushButton.textContent = 'Loading...';
        break;
      case 'incompatible':
        pushButton.disabled = true;
        pushButton.textContent = 'Push notifications are not compatible with this browser';
        break;
      default:
        console.error('Unhandled push button state', state);
        break;
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function checkNotificationPermission() {
    return new Promise((resolve, reject) => {
      if (Notification.permission === 'denied') {
        return reject(new Error('Push messages are blocked.'));
      }

      if (Notification.permission === 'granted') {
        return resolve();
      }

      if (Notification.permission === 'default') {
        return Notification.requestPermission().then(result => {
          if (result !== 'granted') {
            reject(new Error('Bad permission result'));
          } else {
            resolve();
          }
        });
      }

      return reject(new Error('Unknown permission'));
    });
  }

  function enablePush() {
    changePushButtonState('computing');
    checkNotificationPermission()
        .then(() => navigator.serviceWorker.ready)
        .then(serviceWorkerRegistration =>
            serviceWorkerRegistration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(applicationServerKey),
            })
        )
        .then(subscription => {
          console.info('Browser notifications are activated!');
          changePushButtonState('enabled')
        })
        .then(subscription => subscription && changePushButtonState('enabled')) // update your UI
        .catch(e => {
          if (Notification.permission === 'denied') {
            console.warn('Notifications are denied by the user.');
            changePushButtonState('incompatible');
          } else {
            console.error('Impossible to subscribe to push notifications', e);
            changePushButtonState('disabled');
          }
        });
  }

  function disablePush() {
    changePushButtonState('computing');

    // To unsubscribe from push messaging, you need to get the subscription object
    navigator.serviceWorker.ready
        .then(serviceWorkerRegistration => serviceWorkerRegistration.pushManager.getSubscription())
        .then(subscription => {
          changePushButtonState('disabled');
        })
        .then(subscription => subscription.unsubscribe())
        .then(() => changePushButtonState('disabled'))
        .catch(e => {
          // We failed to unsubscribe, this can lead to
          // an unusual state, so  it may be best to remove
          // the users data from your data store and
          // inform the user that you have done so
          console.error('Error when unsubscribing the user', e);
          changePushButtonState('disabled');
        });
  }

  async function getToken() {
    const response = await fetch('http://glue-backend.de.spryker.local/token', {
      method: "POST",
      body: JSON.stringify({
        grantType: "password",
        username: "harald@spryker.com",
        password: "change123"
      }),
    });

    return response.json()
  }

  async function push_sendSubscriptionToServer(subscription) {
    const tokenScos = await getToken();
    const accessToken = tokenScos[0].access_token;
    const key = subscription.getKey('p256dh');
    const token = subscription.getKey('auth');

    return fetch('http://glue-backend.de.spryker.local/push-notification-subscriptions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          type: "push-notification-subscriptions",
          attributes: {
            providerName: "web-push-php",
            group: {
              name: "warehouse",
              identifier: 1234
            },
            'payload': {
              endpoint: subscription.endpoint,
              publicKey: key ? btoa(String.fromCharCode.apply(null, new Uint8Array(key))) : null,
              authToken: token ? btoa(String.fromCharCode.apply(null, new Uint8Array(token))) : null,
            }
          }
        }
      }),
    }).then(() => subscription);
  }
});