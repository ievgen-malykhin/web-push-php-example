<?php
require __DIR__ . '/../vendor/autoload.php';
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

$auth = array(
    'VAPID' => array(
        'subject' => 'https://spryker.com',
        'publicKey' => 'BDzEeyH3FpzBi70ulr6SSMoqtAvrWHen3klcrom1WQ_tTKPKgOfrUIXYWZzxH5TVu25RLeaw7MwOUWd7aljzCeU', // don't forget that your public key also lives in app.js
        'privateKey' => '4zgOiaiM0X2duaKA4GLWnLqJsB-3lTWL7znH73YsXYY', // in the real world, this would be in a secret file
    ),
);

$webPush = new WebPush($auth);
$plainSubscriptions = json_decode(file_get_contents('src/php_local_storage.json'), true);

foreach ($plainSubscriptions as $plainSubscription) {
    $subscription = Subscription::create($plainSubscription);

    $webPush->queueNotification(
        $subscription,
        "Hello world via push notification rand-" . rand(0, 1000)
    );
}

foreach ($webPush->flush() as $report) {
    $endpoint = $report->getRequest()->getUri()->__toString();

    if ($report->isSuccess()) {
        echo "[v] Message sent successfully for subscription {$endpoint}.";
    } else {
        echo "[x] Message failed to sent for subscription {$endpoint}: {$report->getReason()}";
    }
}

