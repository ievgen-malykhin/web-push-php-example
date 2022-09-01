<?php
$subscription = json_decode(file_get_contents('php://input'), true);

if (!isset($subscription['endpoint'])) {
    echo 'Error: not a subscription';
    return;
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'POST':
        $tempArray = json_decode(file_get_contents('src/php_local_storage.json'), true);
        array_push($tempArray, $subscription);

        $jsonData = json_encode($tempArray);
        file_put_contents('src/php_local_storage.json', $jsonData);
        break;
    case 'PUT':
        // update the key and token of subscription corresponding to the endpoint
        break;
    case 'DELETE':
        file_put_contents('src/php_local_storage.json', '[]');
        break;
    default:
        echo "Error: method not handled";
        return;
}
