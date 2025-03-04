#!/bin/bash

set -e # Exit on error

source .env

# Add users
curl -k -X POST $HOST/api/auth -d '{"name":"pizza diner", "email":"d@jwt.com", "password":"diner"}' -H 'Content-Type: application/json'
echo ""
curl -k -X POST $HOST/api/auth -d '{"name":"pizza franchisee", "email":"f@jwt.com", "password":"franchisee"}' -H 'Content-Type: application/json'
echo ""

response=$(curl -s -k -X PUT $HOST/api/auth -d '{"email":"a@jwt.com", "password":"admin"}' -H 'Content-Type: application/json')
token=$(echo $response | jq -r '.token')
echo $response

# Add menu items
curl -k -X PUT $HOST/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Veggie", "description": "A garden of delight", "image":"pizza1.png", "price": 0.0038 }'  -H "Authorization: Bearer $token"
echo ""
curl -k -X PUT $HOST/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Pepperoni", "description": "Spicy treat", "image":"pizza2.png", "price": 0.0042 }'  -H "Authorization: Bearer $token"
echo ""
curl -k -X PUT $HOST/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Margarita", "description": "Essential classic", "image":"pizza3.png", "price": 0.0042 }'  -H "Authorization: Bearer $token"
echo ""
curl -k -X PUT $HOST/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Crusty", "description": "A dry mouthed favorite", "image":"pizza4.png", "price": 0.0028 }'  -H "Authorization: Bearer $token"
echo ""
curl -k -X PUT $HOST/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Charred Leopard", "description": "For those with a darker side", "image":"pizza5.png", "price": 0.0099 }'  -H "Authorization: Bearer $token"
echo ""

# Add franchise and store
curl -k -X POST $HOST/api/franchise -H 'Content-Type: application/json' -d '{"name": "pizzaPocket", "admins": [{"email": "f@jwt.com"}]}'  -H "Authorization: Bearer $token"
echo ""
curl -k -X POST $HOST/api/franchise/1/store -H 'Content-Type: application/json' -d '{"franchiseId": 1, "name":"SLC"}'  -H "Authorization: Bearer $token"
echo ""
