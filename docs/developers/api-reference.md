---
title: ModBM API v1.0
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
highlight_theme: darkula
headingLevel: 2

---

<!-- Generator: Widdershins v4.0.1 -->

<h1 id="modbm-api">ModBM API v1.0</h1>

> Scroll down for code samples, example requests and responses. Select a language for code samples from the tabs above or the mobile navigation menu.

Core Forgeron API System endpoints

Base URLs:

# Authentication

- HTTP Authentication, scheme: bearer 

<h1 id="modbm-api-auth">Auth</h1>

## AuthController_login

<a id="opIdAuthController_login"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/auth/login \
  -H 'Content-Type: application/json'

```

```http
POST /api/auth/login HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "username": "string",
  "password": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/auth/login',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/auth/login',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/auth/login', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/auth/login', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/auth/login");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/auth/login", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/auth/login`

> Body parameter

```json
{
  "username": "string",
  "password": "string"
}
```

<h3 id="authcontroller_login-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[LoginDto](#schemalogindto)|true|none|

<h3 id="authcontroller_login-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AuthController_me

<a id="opIdAuthController_me"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/auth/me

```

```http
GET /api/auth/me HTTP/1.1

```

```javascript

fetch('/api/auth/me',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/auth/me',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/auth/me')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/auth/me', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/auth/me");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/auth/me", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/auth/me`

<h3 id="authcontroller_me-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-accounts">Accounts</h1>

## AccountsController_findAll

<a id="opIdAccountsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/customers

```

```http
GET /api/customers HTTP/1.1

```

```javascript

fetch('/api/customers',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/customers',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/customers')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/customers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/customers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/customers`

<h3 id="accountscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountsController_create

<a id="opIdAccountsController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/customers \
  -H 'Content-Type: application/json'

```

```http
POST /api/customers HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "customerNumber": "string",
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "primaryContactName": "string",
  "primaryContactEmail": "user@example.com",
  "primaryContactPhone": "string",
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "parentCustomerId": "3a73731b-67c3-4488-bb86-fd6f63111ed4",
  "taxCategoryId": "7293cae9-1ff3-4c2d-8fef-c6490a737060",
  "currencyCode": "string",
  "customerDiscount": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/customers',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/customers',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/customers', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/customers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/customers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/customers`

> Body parameter

```json
{
  "customerNumber": "string",
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "primaryContactName": "string",
  "primaryContactEmail": "user@example.com",
  "primaryContactPhone": "string",
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "parentCustomerId": "3a73731b-67c3-4488-bb86-fd6f63111ed4",
  "taxCategoryId": "7293cae9-1ff3-4c2d-8fef-c6490a737060",
  "currencyCode": "string",
  "customerDiscount": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}
```

<h3 id="accountscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateAccountDto](#schemacreateaccountdto)|true|none|

<h3 id="accountscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountsController_findOne

<a id="opIdAccountsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/customers/{id}

```

```http
GET /api/customers/{id} HTTP/1.1

```

```javascript

fetch('/api/customers/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/customers/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/customers/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/customers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/customers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/customers/{id}`

<h3 id="accountscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="accountscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountsController_update

<a id="opIdAccountsController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/customers/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/customers/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "primaryContactName": "string",
  "primaryContactEmail": "user@example.com",
  "primaryContactPhone": "string",
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "stateCode": "string",
  "parentCustomerId": "3a73731b-67c3-4488-bb86-fd6f63111ed4",
  "taxCategoryId": "7293cae9-1ff3-4c2d-8fef-c6490a737060",
  "currencyCode": "string",
  "customerDiscount": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/customers/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/customers/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/customers/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/customers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/customers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/customers/{id}`

> Body parameter

```json
{
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "primaryContactName": "string",
  "primaryContactEmail": "user@example.com",
  "primaryContactPhone": "string",
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "stateCode": "string",
  "parentCustomerId": "3a73731b-67c3-4488-bb86-fd6f63111ed4",
  "taxCategoryId": "7293cae9-1ff3-4c2d-8fef-c6490a737060",
  "currencyCode": "string",
  "customerDiscount": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}
```

<h3 id="accountscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateAccountDto](#schemaupdateaccountdto)|true|none|

<h3 id="accountscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountsController_archive

<a id="opIdAccountsController_archive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/customers/{id}/archive

```

```http
POST /api/customers/{id}/archive HTTP/1.1

```

```javascript

fetch('/api/customers/{id}/archive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/customers/{id}/archive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/customers/{id}/archive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/customers/{id}/archive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customers/{id}/archive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/customers/{id}/archive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/customers/{id}/archive`

<h3 id="accountscontroller_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="accountscontroller_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountsController_unarchive

<a id="opIdAccountsController_unarchive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/customers/{id}/unarchive

```

```http
POST /api/customers/{id}/unarchive HTTP/1.1

```

```javascript

fetch('/api/customers/{id}/unarchive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/customers/{id}/unarchive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/customers/{id}/unarchive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/customers/{id}/unarchive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customers/{id}/unarchive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/customers/{id}/unarchive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/customers/{id}/unarchive`

<h3 id="accountscontroller_unarchive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="accountscontroller_unarchive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-accountgroups">AccountGroups</h1>

## AccountGroupsController_findAll

<a id="opIdAccountGroupsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/customer-groups

```

```http
GET /api/customer-groups HTTP/1.1

```

```javascript

fetch('/api/customer-groups',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/customer-groups',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/customer-groups')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/customer-groups', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customer-groups");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/customer-groups", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/customer-groups`

<h3 id="accountgroupscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountGroupsController_create

<a id="opIdAccountGroupsController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/customer-groups \
  -H 'Content-Type: application/json'

```

```http
POST /api/customer-groups HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "groupCode": "string",
  "name": "string",
  "defaultDiscountPercentage": "string",
  "defaultArAccountId": "46ad366b-db2c-42d7-8db1-9f98ad689951",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/customer-groups',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/customer-groups',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/customer-groups', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/customer-groups', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customer-groups");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/customer-groups", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/customer-groups`

> Body parameter

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultDiscountPercentage": "string",
  "defaultArAccountId": "46ad366b-db2c-42d7-8db1-9f98ad689951",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}
```

<h3 id="accountgroupscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateAccountGroupDto](#schemacreateaccountgroupdto)|true|none|

<h3 id="accountgroupscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountGroupsController_findOne

<a id="opIdAccountGroupsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/customer-groups/{id}

```

```http
GET /api/customer-groups/{id} HTTP/1.1

```

```javascript

fetch('/api/customer-groups/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/customer-groups/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/customer-groups/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/customer-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customer-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/customer-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/customer-groups/{id}`

<h3 id="accountgroupscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="accountgroupscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountGroupsController_update

<a id="opIdAccountGroupsController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/customer-groups/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/customer-groups/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "groupCode": "string",
  "name": "string",
  "defaultDiscountPercentage": "string",
  "defaultArAccountId": "46ad366b-db2c-42d7-8db1-9f98ad689951",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/customer-groups/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/customer-groups/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/customer-groups/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/customer-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customer-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/customer-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/customer-groups/{id}`

> Body parameter

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultDiscountPercentage": "string",
  "defaultArAccountId": "46ad366b-db2c-42d7-8db1-9f98ad689951",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}
```

<h3 id="accountgroupscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateAccountGroupDto](#schemaupdateaccountgroupdto)|true|none|

<h3 id="accountgroupscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AccountGroupsController_remove

<a id="opIdAccountGroupsController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/customer-groups/{id}

```

```http
DELETE /api/customer-groups/{id} HTTP/1.1

```

```javascript

fetch('/api/customer-groups/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/customer-groups/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/customer-groups/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/customer-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/customer-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/customer-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/customer-groups/{id}`

<h3 id="accountgroupscontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="accountgroupscontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-products">Products</h1>

## ProductsController_findAll

<a id="opIdProductsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/products

```

```http
GET /api/products HTTP/1.1

```

```javascript

fetch('/api/products',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/products',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/products')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/products', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/products", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/products`

<h3 id="productscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_create

<a id="opIdProductsController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products \
  -H 'Content-Type: application/json'

```

```http
POST /api/products HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "productNumber": "string",
  "name": "string",
  "productType": {},
  "structureType": {},
  "barcode": "string",
  "listPrice": "string",
  "standardCost": "string",
  "tradePrice": "string",
  "priceLevel3": "string",
  "priceLevel4": "string",
  "purchaseTaxCategoryId": "11fec267-6c3d-4506-9298-0971e9aa3376",
  "salesTaxCategoryId": "cd956b50-0617-4a4c-8fe1-709bac4051e3",
  "alternateProductNumber": "string",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "notes": "string",
  "stateCode": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/products',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/products',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/products', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products`

> Body parameter

```json
{
  "productNumber": "string",
  "name": "string",
  "productType": {},
  "structureType": {},
  "barcode": "string",
  "listPrice": "string",
  "standardCost": "string",
  "tradePrice": "string",
  "priceLevel3": "string",
  "priceLevel4": "string",
  "purchaseTaxCategoryId": "11fec267-6c3d-4506-9298-0971e9aa3376",
  "salesTaxCategoryId": "cd956b50-0617-4a4c-8fe1-709bac4051e3",
  "alternateProductNumber": "string",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "notes": "string",
  "stateCode": "string"
}
```

<h3 id="productscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateProductDto](#schemacreateproductdto)|true|none|

<h3 id="productscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_findOne

<a id="opIdProductsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/products/{id}

```

```http
GET /api/products/{id} HTTP/1.1

```

```javascript

fetch('/api/products/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/products/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/products/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/products/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/products/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/products/{id}`

<h3 id="productscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_update

<a id="opIdProductsController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/products/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/products/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "productNumber": "string",
  "name": "string",
  "productType": {},
  "structureType": {},
  "barcode": "string",
  "listPrice": "string",
  "standardCost": "string",
  "tradePrice": "string",
  "priceLevel3": "string",
  "priceLevel4": "string",
  "purchaseTaxCategoryId": "11fec267-6c3d-4506-9298-0971e9aa3376",
  "salesTaxCategoryId": "cd956b50-0617-4a4c-8fe1-709bac4051e3",
  "alternateProductNumber": "string",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "notes": "string",
  "stateCode": "string",
  "baseUom": "string",
  "defaultSalesUomId": "e98bfa36-b509-495e-a274-1c22bbc3d351",
  "defaultPurchaseUomId": "42701981-555a-470b-9596-2acd8c029026"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/products/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/products/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/products/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/products/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/products/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/products/{id}`

> Body parameter

```json
{
  "productNumber": "string",
  "name": "string",
  "productType": {},
  "structureType": {},
  "barcode": "string",
  "listPrice": "string",
  "standardCost": "string",
  "tradePrice": "string",
  "priceLevel3": "string",
  "priceLevel4": "string",
  "purchaseTaxCategoryId": "11fec267-6c3d-4506-9298-0971e9aa3376",
  "salesTaxCategoryId": "cd956b50-0617-4a4c-8fe1-709bac4051e3",
  "alternateProductNumber": "string",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "notes": "string",
  "stateCode": "string",
  "baseUom": "string",
  "defaultSalesUomId": "e98bfa36-b509-495e-a274-1c22bbc3d351",
  "defaultPurchaseUomId": "42701981-555a-470b-9596-2acd8c029026"
}
```

<h3 id="productscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateProductDto](#schemaupdateproductdto)|true|none|

<h3 id="productscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_archive

<a id="opIdProductsController_archive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products/{id}/archive

```

```http
POST /api/products/{id}/archive HTTP/1.1

```

```javascript

fetch('/api/products/{id}/archive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/products/{id}/archive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/products/{id}/archive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products/{id}/archive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/archive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products/{id}/archive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products/{id}/archive`

<h3 id="productscontroller_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productscontroller_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_unarchive

<a id="opIdProductsController_unarchive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products/{id}/unarchive

```

```http
POST /api/products/{id}/unarchive HTTP/1.1

```

```javascript

fetch('/api/products/{id}/unarchive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/products/{id}/unarchive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/products/{id}/unarchive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products/{id}/unarchive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/unarchive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products/{id}/unarchive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products/{id}/unarchive`

<h3 id="productscontroller_unarchive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productscontroller_unarchive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_addSupplier

<a id="opIdProductsController_addSupplier"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products/{id}/suppliers \
  -H 'Content-Type: application/json'

```

```http
POST /api/products/{id}/suppliers HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "vendorId": "e9b57fab-1850-44d4-8499-71fd15c845a0",
  "supplierPartNumber": "string",
  "costPrice": 0,
  "effectiveFrom": "string",
  "effectiveTo": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/products/{id}/suppliers',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/products/{id}/suppliers',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/products/{id}/suppliers', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products/{id}/suppliers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/suppliers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products/{id}/suppliers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products/{id}/suppliers`

> Body parameter

```json
{
  "vendorId": "e9b57fab-1850-44d4-8499-71fd15c845a0",
  "supplierPartNumber": "string",
  "costPrice": 0,
  "effectiveFrom": "string",
  "effectiveTo": "string"
}
```

<h3 id="productscontroller_addsupplier-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[AddSupplierDto](#schemaaddsupplierdto)|true|none|

<h3 id="productscontroller_addsupplier-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_removeSupplier

<a id="opIdProductsController_removeSupplier"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/products/{id}/suppliers/{vendorId}

```

```http
DELETE /api/products/{id}/suppliers/{vendorId} HTTP/1.1

```

```javascript

fetch('/api/products/{id}/suppliers/{vendorId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/products/{id}/suppliers/{vendorId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/products/{id}/suppliers/{vendorId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/products/{id}/suppliers/{vendorId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/suppliers/{vendorId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/products/{id}/suppliers/{vendorId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/products/{id}/suppliers/{vendorId}`

<h3 id="productscontroller_removesupplier-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|vendorId|path|string|true|none|

<h3 id="productscontroller_removesupplier-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_addUom

<a id="opIdProductsController_addUom"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products/{id}/uoms

```

```http
POST /api/products/{id}/uoms HTTP/1.1

```

```javascript

fetch('/api/products/{id}/uoms',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/products/{id}/uoms',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/products/{id}/uoms')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products/{id}/uoms', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/uoms");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products/{id}/uoms", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products/{id}/uoms`

<h3 id="productscontroller_adduom-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productscontroller_adduom-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_removeUom

<a id="opIdProductsController_removeUom"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/products/{id}/uoms/{uomId}

```

```http
DELETE /api/products/{id}/uoms/{uomId} HTTP/1.1

```

```javascript

fetch('/api/products/{id}/uoms/{uomId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/products/{id}/uoms/{uomId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/products/{id}/uoms/{uomId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/products/{id}/uoms/{uomId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/uoms/{uomId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/products/{id}/uoms/{uomId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/products/{id}/uoms/{uomId}`

<h3 id="productscontroller_removeuom-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|uomId|path|string|true|none|

<h3 id="productscontroller_removeuom-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_linkDefaultBin

<a id="opIdProductsController_linkDefaultBin"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products/{id}/default-bins \
  -H 'Content-Type: application/json'

```

```http
POST /api/products/{id}/default-bins HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "locationId": "1a5515a3-ba81-4a42-aee7-ad9ffc090a54",
  "binId": "bb3ec690-443a-44a2-b217-5deec3a3c27e",
  "isPrimaryPerLocation": true,
  "minQuantity": "string",
  "maxQuantity": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/products/{id}/default-bins',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/products/{id}/default-bins',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/products/{id}/default-bins', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products/{id}/default-bins', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/default-bins");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products/{id}/default-bins", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products/{id}/default-bins`

> Body parameter

```json
{
  "locationId": "1a5515a3-ba81-4a42-aee7-ad9ffc090a54",
  "binId": "bb3ec690-443a-44a2-b217-5deec3a3c27e",
  "isPrimaryPerLocation": true,
  "minQuantity": "string",
  "maxQuantity": "string"
}
```

<h3 id="productscontroller_linkdefaultbin-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[LinkBinDto](#schemalinkbindto)|true|none|

<h3 id="productscontroller_linkdefaultbin-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_removeDefaultBin

<a id="opIdProductsController_removeDefaultBin"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/products/{id}/default-bins/{binLinkId}

```

```http
DELETE /api/products/{id}/default-bins/{binLinkId} HTTP/1.1

```

```javascript

fetch('/api/products/{id}/default-bins/{binLinkId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/products/{id}/default-bins/{binLinkId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/products/{id}/default-bins/{binLinkId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/products/{id}/default-bins/{binLinkId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/default-bins/{binLinkId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/products/{id}/default-bins/{binLinkId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/products/{id}/default-bins/{binLinkId}`

<h3 id="productscontroller_removedefaultbin-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|binLinkId|path|string|true|none|

<h3 id="productscontroller_removedefaultbin-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_getComponents

<a id="opIdProductsController_getComponents"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/products/{id}/components

```

```http
GET /api/products/{id}/components HTTP/1.1

```

```javascript

fetch('/api/products/{id}/components',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/products/{id}/components',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/products/{id}/components')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/products/{id}/components', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/components");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/products/{id}/components", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/products/{id}/components`

<h3 id="productscontroller_getcomponents-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productscontroller_getcomponents-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_addComponent

<a id="opIdProductsController_addComponent"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/products/{id}/components

```

```http
POST /api/products/{id}/components HTTP/1.1

```

```javascript

fetch('/api/products/{id}/components',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/products/{id}/components',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/products/{id}/components')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/products/{id}/components', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/components");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/products/{id}/components", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/products/{id}/components`

<h3 id="productscontroller_addcomponent-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productscontroller_addcomponent-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_updateComponent

<a id="opIdProductsController_updateComponent"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/products/{id}/components/{componentId}

```

```http
PATCH /api/products/{id}/components/{componentId} HTTP/1.1

```

```javascript

fetch('/api/products/{id}/components/{componentId}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/products/{id}/components/{componentId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/products/{id}/components/{componentId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/products/{id}/components/{componentId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/components/{componentId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/products/{id}/components/{componentId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/products/{id}/components/{componentId}`

<h3 id="productscontroller_updatecomponent-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|componentId|path|string|true|none|

<h3 id="productscontroller_updatecomponent-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductsController_removeComponent

<a id="opIdProductsController_removeComponent"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/products/{id}/components/{componentId}

```

```http
DELETE /api/products/{id}/components/{componentId} HTTP/1.1

```

```javascript

fetch('/api/products/{id}/components/{componentId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/products/{id}/components/{componentId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/products/{id}/components/{componentId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/products/{id}/components/{componentId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/products/{id}/components/{componentId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/products/{id}/components/{componentId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/products/{id}/components/{componentId}`

<h3 id="productscontroller_removecomponent-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|componentId|path|string|true|none|

<h3 id="productscontroller_removecomponent-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-productgroups">ProductGroups</h1>

## ProductGroupsController_findAll

<a id="opIdProductGroupsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/product-groups

```

```http
GET /api/product-groups HTTP/1.1

```

```javascript

fetch('/api/product-groups',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/product-groups',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/product-groups')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/product-groups', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/product-groups");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/product-groups", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/product-groups`

<h3 id="productgroupscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductGroupsController_create

<a id="opIdProductGroupsController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/product-groups \
  -H 'Content-Type: application/json'

```

```http
POST /api/product-groups HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "groupCode": "string",
  "name": "string",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/product-groups',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/product-groups',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/product-groups', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/product-groups', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/product-groups");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/product-groups", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/product-groups`

> Body parameter

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}
```

<h3 id="productgroupscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateProductGroupDto](#schemacreateproductgroupdto)|true|none|

<h3 id="productgroupscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductGroupsController_findOne

<a id="opIdProductGroupsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/product-groups/{id}

```

```http
GET /api/product-groups/{id} HTTP/1.1

```

```javascript

fetch('/api/product-groups/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/product-groups/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/product-groups/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/product-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/product-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/product-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/product-groups/{id}`

<h3 id="productgroupscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productgroupscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductGroupsController_update

<a id="opIdProductGroupsController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/product-groups/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/product-groups/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "groupCode": "string",
  "name": "string",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/product-groups/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/product-groups/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/product-groups/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/product-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/product-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/product-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/product-groups/{id}`

> Body parameter

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}
```

<h3 id="productgroupscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateProductGroupDto](#schemaupdateproductgroupdto)|true|none|

<h3 id="productgroupscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ProductGroupsController_remove

<a id="opIdProductGroupsController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/product-groups/{id}

```

```http
DELETE /api/product-groups/{id} HTTP/1.1

```

```javascript

fetch('/api/product-groups/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/product-groups/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/product-groups/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/product-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/product-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/product-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/product-groups/{id}`

<h3 id="productgroupscontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="productgroupscontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-inventory">Inventory</h1>

## InventoryController_findAll

<a id="opIdInventoryController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory?locationNo=string

```

```http
GET /api/inventory?locationNo=string HTTP/1.1

```

```javascript

fetch('/api/inventory?locationNo=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory',
  params: {
  'locationNo' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory', params={
  'locationNo': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory?locationNo=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory`

<h3 id="inventorycontroller_findall-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|locationNo|query|string|true|none|

<h3 id="inventorycontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_findByProductIds

<a id="opIdInventoryController_findByProductIds"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/by-products?productIds=string&locationId=string

```

```http
GET /api/inventory/by-products?productIds=string&locationId=string HTTP/1.1

```

```javascript

fetch('/api/inventory/by-products?productIds=string&locationId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/by-products',
  params: {
  'productIds' => 'string',
'locationId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/by-products', params={
  'productIds': 'string',  'locationId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/by-products', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/by-products?productIds=string&locationId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/by-products", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/by-products`

<h3 id="inventorycontroller_findbyproductids-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productIds|query|string|true|none|
|locationId|query|string|true|none|

<h3 id="inventorycontroller_findbyproductids-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_findByProductIdsBulk

<a id="opIdInventoryController_findByProductIdsBulk"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/inventory/by-products-bulk

```

```http
POST /api/inventory/by-products-bulk HTTP/1.1

```

```javascript

fetch('/api/inventory/by-products-bulk',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/inventory/by-products-bulk',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/inventory/by-products-bulk')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/inventory/by-products-bulk', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/by-products-bulk");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/inventory/by-products-bulk", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/inventory/by-products-bulk`

<h3 id="inventorycontroller_findbyproductidsbulk-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_findBins

<a id="opIdInventoryController_findBins"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/bins?locationNo=string

```

```http
GET /api/inventory/bins?locationNo=string HTTP/1.1

```

```javascript

fetch('/api/inventory/bins?locationNo=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/bins',
  params: {
  'locationNo' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/bins', params={
  'locationNo': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/bins', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/bins?locationNo=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/bins", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/bins`

<h3 id="inventorycontroller_findbins-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|locationNo|query|string|true|none|

<h3 id="inventorycontroller_findbins-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_getPutawayContext

<a id="opIdInventoryController_getPutawayContext"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/putaway-context?productId=string&locationId=string

```

```http
GET /api/inventory/putaway-context?productId=string&locationId=string HTTP/1.1

```

```javascript

fetch('/api/inventory/putaway-context?productId=string&locationId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/putaway-context',
  params: {
  'productId' => 'string',
'locationId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/putaway-context', params={
  'productId': 'string',  'locationId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/putaway-context', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/putaway-context?productId=string&locationId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/putaway-context", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/putaway-context`

<h3 id="inventorycontroller_getputawaycontext-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productId|query|string|true|none|
|locationId|query|string|true|none|

<h3 id="inventorycontroller_getputawaycontext-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_findAllLocations

<a id="opIdInventoryController_findAllLocations"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/locations?productId=string

```

```http
GET /api/inventory/locations?productId=string HTTP/1.1

```

```javascript

fetch('/api/inventory/locations?productId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/locations',
  params: {
  'productId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/locations', params={
  'productId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/locations', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/locations?productId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/locations", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/locations`

<h3 id="inventorycontroller_findalllocations-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productId|query|string|true|none|

<h3 id="inventorycontroller_findalllocations-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_getMovements

<a id="opIdInventoryController_getMovements"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/movements?days=string

```

```http
GET /api/inventory/movements?days=string HTTP/1.1

```

```javascript

fetch('/api/inventory/movements?days=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/movements',
  params: {
  'days' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/movements', params={
  'days': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/movements', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/movements?days=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/movements", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/movements`

<h3 id="inventorycontroller_getmovements-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|days|query|string|true|none|

<h3 id="inventorycontroller_getmovements-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_getLedger

<a id="opIdInventoryController_getLedger"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/ledger?days=string

```

```http
GET /api/inventory/ledger?days=string HTTP/1.1

```

```javascript

fetch('/api/inventory/ledger?days=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/ledger',
  params: {
  'days' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/ledger', params={
  'days': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/ledger', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/ledger?days=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/ledger", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/ledger`

<h3 id="inventorycontroller_getledger-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|days|query|string|true|none|

<h3 id="inventorycontroller_getledger-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_getEntryDetails

<a id="opIdInventoryController_getEntryDetails"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/entries/{id}

```

```http
GET /api/inventory/entries/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/entries/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/entries/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/entries/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/entries/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/entries/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/entries/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/entries/{id}`

<h3 id="inventorycontroller_getentrydetails-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="inventorycontroller_getentrydetails-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_getPendingPutaway

<a id="opIdInventoryController_getPendingPutaway"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/inventory/pending-putaway?locationId=string

```

```http
GET /api/inventory/pending-putaway?locationId=string HTTP/1.1

```

```javascript

fetch('/api/inventory/pending-putaway?locationId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/inventory/pending-putaway',
  params: {
  'locationId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/inventory/pending-putaway', params={
  'locationId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/inventory/pending-putaway', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/pending-putaway?locationId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/inventory/pending-putaway", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/inventory/pending-putaway`

<h3 id="inventorycontroller_getpendingputaway-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|locationId|query|string|true|none|

<h3 id="inventorycontroller_getpendingputaway-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_putaway

<a id="opIdInventoryController_putaway"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/inventory/putaway \
  -H 'Content-Type: application/json'

```

```http
POST /api/inventory/putaway HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "putaways": [
    {
      "lineId": "string",
      "sourceType": "goods_receipt",
      "destinationBinId": "string",
      "quantity": "string",
      "newTotalQuantity": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/inventory/putaway',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/inventory/putaway',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/inventory/putaway', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/inventory/putaway', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/putaway");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/inventory/putaway", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/inventory/putaway`

> Body parameter

```json
{
  "putaways": [
    {
      "lineId": "string",
      "sourceType": "goods_receipt",
      "destinationBinId": "string",
      "quantity": "string",
      "newTotalQuantity": "string"
    }
  ]
}
```

<h3 id="inventorycontroller_putaway-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[PutawayBulkDto](#schemaputawaybulkdto)|true|none|

<h3 id="inventorycontroller_putaway-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InventoryController_toggleQuarantine

<a id="opIdInventoryController_toggleQuarantine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/inventory/quarantine/{lineId} \
  -H 'Content-Type: application/json'

```

```http
POST /api/inventory/quarantine/{lineId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "sourceType": "goods_receipt",
  "reason": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/inventory/quarantine/{lineId}',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/inventory/quarantine/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/inventory/quarantine/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/inventory/quarantine/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/quarantine/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/inventory/quarantine/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/inventory/quarantine/{lineId}`

> Body parameter

```json
{
  "sourceType": "goods_receipt",
  "reason": "string"
}
```

<h3 id="inventorycontroller_togglequarantine-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|lineId|path|string|true|none|
|body|body|[ToggleQuarantineDto](#schematogglequarantinedto)|true|none|

<h3 id="inventorycontroller_togglequarantine-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-locations">Locations</h1>

## LocationsController_createBin

<a id="opIdLocationsController_createBin"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/inventory/bins \
  -H 'Content-Type: application/json'

```

```http
POST /api/inventory/bins HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "zoneId": "c3920607-5069-4ac3-ba10-00754e7a8e8b",
  "binNumber": "string",
  "binType": "storage",
  "isConsignment": true,
  "isBonded": true,
  "isUnavailable": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/inventory/bins',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/inventory/bins',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/inventory/bins', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/inventory/bins', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/bins");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/inventory/bins", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/inventory/bins`

> Body parameter

```json
{
  "zoneId": "c3920607-5069-4ac3-ba10-00754e7a8e8b",
  "binNumber": "string",
  "binType": "storage",
  "isConsignment": true,
  "isBonded": true,
  "isUnavailable": true
}
```

<h3 id="locationscontroller_createbin-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateBinDto](#schemacreatebindto)|true|none|

<h3 id="locationscontroller_createbin-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_createLocation

<a id="opIdLocationsController_createLocation"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/inventory/locations \
  -H 'Content-Type: application/json'

```

```http
POST /api/inventory/locations HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "code": "string",
  "name": "string",
  "addressLine1": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postCode": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/inventory/locations',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/inventory/locations',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/inventory/locations', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/inventory/locations', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/locations");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/inventory/locations", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/inventory/locations`

> Body parameter

```json
{
  "code": "string",
  "name": "string",
  "addressLine1": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postCode": "string"
}
```

<h3 id="locationscontroller_createlocation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateLocationDto](#schemacreatelocationdto)|true|none|

<h3 id="locationscontroller_createlocation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_updateLocation

<a id="opIdLocationsController_updateLocation"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/inventory/locations/{id}

```

```http
PATCH /api/inventory/locations/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/locations/{id}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/inventory/locations/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/inventory/locations/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/inventory/locations/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/locations/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/inventory/locations/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/inventory/locations/{id}`

<h3 id="locationscontroller_updatelocation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="locationscontroller_updatelocation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_deleteLocation

<a id="opIdLocationsController_deleteLocation"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/inventory/locations/{id}

```

```http
DELETE /api/inventory/locations/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/locations/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/inventory/locations/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/inventory/locations/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/inventory/locations/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/locations/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/inventory/locations/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/inventory/locations/{id}`

<h3 id="locationscontroller_deletelocation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="locationscontroller_deletelocation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_createZone

<a id="opIdLocationsController_createZone"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/inventory/zones \
  -H 'Content-Type: application/json'

```

```http
POST /api/inventory/zones HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "locationId": "1a5515a3-ba81-4a42-aee7-ad9ffc090a54",
  "code": "string",
  "name": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/inventory/zones',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/inventory/zones',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/inventory/zones', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/inventory/zones', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/zones");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/inventory/zones", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/inventory/zones`

> Body parameter

```json
{
  "locationId": "1a5515a3-ba81-4a42-aee7-ad9ffc090a54",
  "code": "string",
  "name": "string"
}
```

<h3 id="locationscontroller_createzone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateZoneDto](#schemacreatezonedto)|true|none|

<h3 id="locationscontroller_createzone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_updateZone

<a id="opIdLocationsController_updateZone"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/inventory/zones/{id}

```

```http
PATCH /api/inventory/zones/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/zones/{id}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/inventory/zones/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/inventory/zones/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/inventory/zones/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/zones/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/inventory/zones/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/inventory/zones/{id}`

<h3 id="locationscontroller_updatezone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="locationscontroller_updatezone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_deleteZone

<a id="opIdLocationsController_deleteZone"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/inventory/zones/{id}

```

```http
DELETE /api/inventory/zones/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/zones/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/inventory/zones/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/inventory/zones/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/inventory/zones/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/zones/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/inventory/zones/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/inventory/zones/{id}`

<h3 id="locationscontroller_deletezone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="locationscontroller_deletezone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_updateBin

<a id="opIdLocationsController_updateBin"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/inventory/bins/{id}

```

```http
PATCH /api/inventory/bins/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/bins/{id}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/inventory/bins/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/inventory/bins/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/inventory/bins/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/bins/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/inventory/bins/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/inventory/bins/{id}`

<h3 id="locationscontroller_updatebin-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="locationscontroller_updatebin-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## LocationsController_deleteBin

<a id="opIdLocationsController_deleteBin"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/inventory/bins/{id}

```

```http
DELETE /api/inventory/bins/{id} HTTP/1.1

```

```javascript

fetch('/api/inventory/bins/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/inventory/bins/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/inventory/bins/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/inventory/bins/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/inventory/bins/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/inventory/bins/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/inventory/bins/{id}`

<h3 id="locationscontroller_deletebin-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="locationscontroller_deletebin-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-gl">Gl</h1>

## GlController_getAccounts

<a id="opIdGlController_getAccounts"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/accounts?format=string&isBankAccount=string \
  -H 'Accept: application/json'

```

```http
GET /api/gl/accounts?format=string&isBankAccount=string HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/gl/accounts?format=string&isBankAccount=string',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/gl/accounts',
  params: {
  'format' => 'string',
'isBankAccount' => 'string'
}, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/gl/accounts', params={
  'format': 'string',  'isBankAccount': 'string'
}, headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/accounts', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/accounts?format=string&isBankAccount=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/accounts", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/accounts`

<h3 id="glcontroller_getaccounts-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|format|query|string|true|none|
|isBankAccount|query|string|true|none|

> Example responses

> 200 Response

```json
[
  {}
]
```

<h3 id="glcontroller_getaccounts-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="glcontroller_getaccounts-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## GlController_createAccount

<a id="opIdGlController_createAccount"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/accounts

```

```http
POST /api/gl/accounts HTTP/1.1

```

```javascript

fetch('/api/gl/accounts',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/gl/accounts',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/gl/accounts')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/accounts', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/accounts");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/accounts", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/accounts`

<h3 id="glcontroller_createaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_updateAccount

<a id="opIdGlController_updateAccount"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/gl/accounts/{id}

```

```http
PATCH /api/gl/accounts/{id} HTTP/1.1

```

```javascript

fetch('/api/gl/accounts/{id}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/gl/accounts/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/gl/accounts/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/gl/accounts/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/accounts/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/gl/accounts/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/gl/accounts/{id}`

<h3 id="glcontroller_updateaccount-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="glcontroller_updateaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_getJournalEntries

<a id="opIdGlController_getJournalEntries"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/journal-entries?fromDate=string&toDate=string&sourceType=string&q=string&limit=string&page=string

```

```http
GET /api/gl/journal-entries?fromDate=string&toDate=string&sourceType=string&q=string&limit=string&page=string HTTP/1.1

```

```javascript

fetch('/api/gl/journal-entries?fromDate=string&toDate=string&sourceType=string&q=string&limit=string&page=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/journal-entries',
  params: {
  'fromDate' => 'string',
'toDate' => 'string',
'sourceType' => 'string',
'q' => 'string',
'limit' => 'string',
'page' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/journal-entries', params={
  'fromDate': 'string',  'toDate': 'string',  'sourceType': 'string',  'q': 'string',  'limit': 'string',  'page': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/journal-entries', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/journal-entries?fromDate=string&toDate=string&sourceType=string&q=string&limit=string&page=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/journal-entries", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/journal-entries`

<h3 id="glcontroller_getjournalentries-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|fromDate|query|string|true|none|
|toDate|query|string|true|none|
|sourceType|query|string|true|none|
|q|query|string|true|none|
|limit|query|string|true|none|
|page|query|string|true|none|

<h3 id="glcontroller_getjournalentries-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_createManualJournalEntry

<a id="opIdGlController_createManualJournalEntry"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/journal-entries

```

```http
POST /api/gl/journal-entries HTTP/1.1

```

```javascript

fetch('/api/gl/journal-entries',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/gl/journal-entries',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/gl/journal-entries')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/journal-entries', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/journal-entries");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/journal-entries", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/journal-entries`

<h3 id="glcontroller_createmanualjournalentry-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_getJournalEntry

<a id="opIdGlController_getJournalEntry"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/journal-entries/{id}

```

```http
GET /api/gl/journal-entries/{id} HTTP/1.1

```

```javascript

fetch('/api/gl/journal-entries/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/journal-entries/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/journal-entries/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/journal-entries/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/journal-entries/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/journal-entries/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/journal-entries/{id}`

<h3 id="glcontroller_getjournalentry-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="glcontroller_getjournalentry-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_getJournalEntryBySource

<a id="opIdGlController_getJournalEntryBySource"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/journal-entries/source/{type}/{id} \
  -H 'Accept: application/json'

```

```http
GET /api/gl/journal-entries/source/{type}/{id} HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/gl/journal-entries/source/{type}/{id}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/gl/journal-entries/source/{type}/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/gl/journal-entries/source/{type}/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/journal-entries/source/{type}/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/journal-entries/source/{type}/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/journal-entries/source/{type}/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/journal-entries/source/{type}/{id}`

<h3 id="glcontroller_getjournalentrybysource-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|type|path|string|true|none|
|id|path|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="glcontroller_getjournalentrybysource-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="glcontroller_getjournalentrybysource-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## GlController_getTrialBalance

<a id="opIdGlController_getTrialBalance"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/trial-balance?asOfDate=string \
  -H 'Accept: application/json'

```

```http
GET /api/gl/trial-balance?asOfDate=string HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/gl/trial-balance?asOfDate=string',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/gl/trial-balance',
  params: {
  'asOfDate' => 'string'
}, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/gl/trial-balance', params={
  'asOfDate': 'string'
}, headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/trial-balance', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/trial-balance?asOfDate=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/trial-balance", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/trial-balance`

<h3 id="glcontroller_gettrialbalance-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|asOfDate|query|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="glcontroller_gettrialbalance-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="glcontroller_gettrialbalance-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## GlController_getGeneralLedger

<a id="opIdGlController_getGeneralLedger"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/general-ledger?account=string&fromDate=string&toDate=string&limit=string&page=string

```

```http
GET /api/gl/general-ledger?account=string&fromDate=string&toDate=string&limit=string&page=string HTTP/1.1

```

```javascript

fetch('/api/gl/general-ledger?account=string&fromDate=string&toDate=string&limit=string&page=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/general-ledger',
  params: {
  'account' => 'string',
'fromDate' => 'string',
'toDate' => 'string',
'limit' => 'string',
'page' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/general-ledger', params={
  'account': 'string',  'fromDate': 'string',  'toDate': 'string',  'limit': 'string',  'page': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/general-ledger', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/general-ledger?account=string&fromDate=string&toDate=string&limit=string&page=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/general-ledger", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/general-ledger`

<h3 id="glcontroller_getgeneralledger-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|account|query|string|true|none|
|fromDate|query|string|true|none|
|toDate|query|string|true|none|
|limit|query|string|true|none|
|page|query|string|true|none|

<h3 id="glcontroller_getgeneralledger-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_getSettings

<a id="opIdGlController_getSettings"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/settings

```

```http
GET /api/gl/settings HTTP/1.1

```

```javascript

fetch('/api/gl/settings',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/settings',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/settings')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/settings', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/settings");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/settings", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/settings`

<h3 id="glcontroller_getsettings-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_updateSettings

<a id="opIdGlController_updateSettings"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/gl/settings

```

```http
PATCH /api/gl/settings HTTP/1.1

```

```javascript

fetch('/api/gl/settings',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/gl/settings',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/gl/settings')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/gl/settings', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/settings");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/gl/settings", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/gl/settings`

<h3 id="glcontroller_updatesettings-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_reloadSettings

<a id="opIdGlController_reloadSettings"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/settings/reload

```

```http
POST /api/gl/settings/reload HTTP/1.1

```

```javascript

fetch('/api/gl/settings/reload',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/gl/settings/reload',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/gl/settings/reload')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/settings/reload', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/settings/reload");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/settings/reload", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/settings/reload`

<h3 id="glcontroller_reloadsettings-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_listCharts

<a id="opIdGlController_listCharts"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/charts

```

```http
GET /api/gl/charts HTTP/1.1

```

```javascript

fetch('/api/gl/charts',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/charts',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/charts')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/charts', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/charts");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/charts", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/charts`

<h3 id="glcontroller_listcharts-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_seedChartOfAccounts

<a id="opIdGlController_seedChartOfAccounts"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/seed

```

```http
POST /api/gl/seed HTTP/1.1

```

```javascript

fetch('/api/gl/seed',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/gl/seed',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/gl/seed')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/seed', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/seed");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/seed", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/seed`

<h3 id="glcontroller_seedchartofaccounts-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_listTaxSettingsFiles

<a id="opIdGlController_listTaxSettingsFiles"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/tax-settings-files

```

```http
GET /api/gl/tax-settings-files HTTP/1.1

```

```javascript

fetch('/api/gl/tax-settings-files',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/tax-settings-files',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/tax-settings-files')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/tax-settings-files', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/tax-settings-files");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/tax-settings-files", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/tax-settings-files`

<h3 id="glcontroller_listtaxsettingsfiles-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlController_seedTaxSettings

<a id="opIdGlController_seedTaxSettings"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/seed-tax

```

```http
POST /api/gl/seed-tax HTTP/1.1

```

```javascript

fetch('/api/gl/seed-tax',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/gl/seed-tax',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/gl/seed-tax')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/seed-tax', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/seed-tax");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/seed-tax", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/seed-tax`

<h3 id="glcontroller_seedtaxsettings-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-gl-reconciliations">GL Reconciliations</h1>

## ReconciliationController_getReconciliations

<a id="opIdReconciliationController_getReconciliations"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/reconciliations

```

```http
GET /api/gl/reconciliations HTTP/1.1

```

```javascript

fetch('/api/gl/reconciliations',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/reconciliations',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/reconciliations')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/reconciliations', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/reconciliations", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/reconciliations`

<h3 id="reconciliationcontroller_getreconciliations-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_createReconciliation

<a id="opIdReconciliationController_createReconciliation"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/reconciliations \
  -H 'Content-Type: application/json'

```

```http
POST /api/gl/reconciliations HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "glAccountId": "string",
  "statementDate": "string",
  "statementBalance": 0,
  "createdBy": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/gl/reconciliations',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/gl/reconciliations',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/gl/reconciliations', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/reconciliations', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/reconciliations", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/reconciliations`

> Body parameter

```json
{
  "glAccountId": "string",
  "statementDate": "string",
  "statementBalance": 0,
  "createdBy": "string"
}
```

<h3 id="reconciliationcontroller_createreconciliation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateReconciliationDto](#schemacreatereconciliationdto)|true|none|

<h3 id="reconciliationcontroller_createreconciliation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_getReconciliation

<a id="opIdReconciliationController_getReconciliation"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/reconciliations/{id}

```

```http
GET /api/gl/reconciliations/{id} HTTP/1.1

```

```javascript

fetch('/api/gl/reconciliations/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/reconciliations/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/reconciliations/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/reconciliations/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/reconciliations/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/reconciliations/{id}`

<h3 id="reconciliationcontroller_getreconciliation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reconciliationcontroller_getreconciliation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_discardReconciliation

<a id="opIdReconciliationController_discardReconciliation"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/gl/reconciliations/{id}

```

```http
DELETE /api/gl/reconciliations/{id} HTTP/1.1

```

```javascript

fetch('/api/gl/reconciliations/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/gl/reconciliations/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/gl/reconciliations/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/gl/reconciliations/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/gl/reconciliations/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/gl/reconciliations/{id}`

<h3 id="reconciliationcontroller_discardreconciliation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reconciliationcontroller_discardreconciliation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_getLines

<a id="opIdReconciliationController_getLines"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/gl/reconciliations/{id}/unreconciled

```

```http
GET /api/gl/reconciliations/{id}/unreconciled HTTP/1.1

```

```javascript

fetch('/api/gl/reconciliations/{id}/unreconciled',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/gl/reconciliations/{id}/unreconciled',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/gl/reconciliations/{id}/unreconciled')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/gl/reconciliations/{id}/unreconciled', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations/{id}/unreconciled");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/gl/reconciliations/{id}/unreconciled", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/gl/reconciliations/{id}/unreconciled`

<h3 id="reconciliationcontroller_getlines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reconciliationcontroller_getlines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_toggleLine

<a id="opIdReconciliationController_toggleLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/reconciliations/{id}/lines/{lineId}/toggle \
  -H 'Content-Type: application/json'

```

```http
POST /api/gl/reconciliations/{id}/lines/{lineId}/toggle HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "isCleared": true,
  "amount": 0
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/gl/reconciliations/{id}/lines/{lineId}/toggle',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/gl/reconciliations/{id}/lines/{lineId}/toggle',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/gl/reconciliations/{id}/lines/{lineId}/toggle', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/reconciliations/{id}/lines/{lineId}/toggle', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations/{id}/lines/{lineId}/toggle");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/reconciliations/{id}/lines/{lineId}/toggle", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/reconciliations/{id}/lines/{lineId}/toggle`

> Body parameter

```json
{
  "isCleared": true,
  "amount": 0
}
```

<h3 id="reconciliationcontroller_toggleline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|
|body|body|[ToggleLineDto](#schematogglelinedto)|true|none|

<h3 id="reconciliationcontroller_toggleline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_postReconciliation

<a id="opIdReconciliationController_postReconciliation"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/reconciliations/{id}/post

```

```http
POST /api/gl/reconciliations/{id}/post HTTP/1.1

```

```javascript

fetch('/api/gl/reconciliations/{id}/post',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/gl/reconciliations/{id}/post',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/gl/reconciliations/{id}/post')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/reconciliations/{id}/post', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations/{id}/post");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/reconciliations/{id}/post", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/reconciliations/{id}/post`

<h3 id="reconciliationcontroller_postreconciliation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reconciliationcontroller_postreconciliation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReconciliationController_createAdjustment

<a id="opIdReconciliationController_createAdjustment"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/gl/reconciliations/{id}/adjustments \
  -H 'Content-Type: application/json'

```

```http
POST /api/gl/reconciliations/{id}/adjustments HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "date": "string",
  "amount": 0,
  "type": {},
  "offsetAccountId": "string",
  "memo": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/gl/reconciliations/{id}/adjustments',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/gl/reconciliations/{id}/adjustments',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/gl/reconciliations/{id}/adjustments', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/gl/reconciliations/{id}/adjustments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/gl/reconciliations/{id}/adjustments");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/gl/reconciliations/{id}/adjustments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/gl/reconciliations/{id}/adjustments`

> Body parameter

```json
{
  "date": "string",
  "amount": 0,
  "type": {},
  "offsetAccountId": "string",
  "memo": "string"
}
```

<h3 id="reconciliationcontroller_createadjustment-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateAdjustmentDto](#schemacreateadjustmentdto)|true|none|

<h3 id="reconciliationcontroller_createadjustment-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-uomdictionary">UomDictionary</h1>

## UomDictionaryController_findAll

<a id="opIdUomDictionaryController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/uom-dictionary

```

```http
GET /api/settings/uom-dictionary HTTP/1.1

```

```javascript

fetch('/api/settings/uom-dictionary',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/uom-dictionary',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/uom-dictionary')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/uom-dictionary', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/uom-dictionary");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/uom-dictionary", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/uom-dictionary`

<h3 id="uomdictionarycontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UomDictionaryController_create

<a id="opIdUomDictionaryController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/settings/uom-dictionary \
  -H 'Content-Type: application/json'

```

```http
POST /api/settings/uom-dictionary HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "uomCode": "string",
  "description": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/uom-dictionary',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/settings/uom-dictionary',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/settings/uom-dictionary', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/settings/uom-dictionary', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/uom-dictionary");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/settings/uom-dictionary", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/settings/uom-dictionary`

> Body parameter

```json
{
  "uomCode": "string",
  "description": "string"
}
```

<h3 id="uomdictionarycontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateUomDto](#schemacreateuomdto)|true|none|

<h3 id="uomdictionarycontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UomDictionaryController_findOne

<a id="opIdUomDictionaryController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/uom-dictionary/{code}

```

```http
GET /api/settings/uom-dictionary/{code} HTTP/1.1

```

```javascript

fetch('/api/settings/uom-dictionary/{code}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/uom-dictionary/{code}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/uom-dictionary/{code}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/uom-dictionary/{code}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/uom-dictionary/{code}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/uom-dictionary/{code}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/uom-dictionary/{code}`

<h3 id="uomdictionarycontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|code|path|string|true|none|

<h3 id="uomdictionarycontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UomDictionaryController_update

<a id="opIdUomDictionaryController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/settings/uom-dictionary/{code} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/settings/uom-dictionary/{code} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "description": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/uom-dictionary/{code}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/settings/uom-dictionary/{code}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/settings/uom-dictionary/{code}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/settings/uom-dictionary/{code}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/uom-dictionary/{code}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/settings/uom-dictionary/{code}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/settings/uom-dictionary/{code}`

> Body parameter

```json
{
  "description": "string"
}
```

<h3 id="uomdictionarycontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|code|path|string|true|none|
|body|body|[UpdateUomDto](#schemaupdateuomdto)|true|none|

<h3 id="uomdictionarycontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UomDictionaryController_remove

<a id="opIdUomDictionaryController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/settings/uom-dictionary/{code}

```

```http
DELETE /api/settings/uom-dictionary/{code} HTTP/1.1

```

```javascript

fetch('/api/settings/uom-dictionary/{code}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/settings/uom-dictionary/{code}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/settings/uom-dictionary/{code}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/settings/uom-dictionary/{code}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/uom-dictionary/{code}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/settings/uom-dictionary/{code}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/settings/uom-dictionary/{code}`

<h3 id="uomdictionarycontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|code|path|string|true|none|

<h3 id="uomdictionarycontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-exchangerates">ExchangeRates</h1>

## ExchangeRatesController_findAll

<a id="opIdExchangeRatesController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/exchange-rates

```

```http
GET /api/settings/exchange-rates HTTP/1.1

```

```javascript

fetch('/api/settings/exchange-rates',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/exchange-rates',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/exchange-rates')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/exchange-rates', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/exchange-rates");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/exchange-rates", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/exchange-rates`

<h3 id="exchangeratescontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ExchangeRatesController_create

<a id="opIdExchangeRatesController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/settings/exchange-rates \
  -H 'Content-Type: application/json'

```

```http
POST /api/settings/exchange-rates HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "currencyCode": "string",
  "currencyName": "string",
  "buyRate": "string",
  "sellRate": "string",
  "effectiveDate": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/exchange-rates',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/settings/exchange-rates',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/settings/exchange-rates', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/settings/exchange-rates', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/exchange-rates");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/settings/exchange-rates", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/settings/exchange-rates`

> Body parameter

```json
{
  "currencyCode": "string",
  "currencyName": "string",
  "buyRate": "string",
  "sellRate": "string",
  "effectiveDate": "string"
}
```

<h3 id="exchangeratescontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateExchangeRateDto](#schemacreateexchangeratedto)|true|none|

<h3 id="exchangeratescontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ExchangeRatesController_findOne

<a id="opIdExchangeRatesController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/exchange-rates/{id}

```

```http
GET /api/settings/exchange-rates/{id} HTTP/1.1

```

```javascript

fetch('/api/settings/exchange-rates/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/exchange-rates/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/exchange-rates/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/exchange-rates/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/exchange-rates/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/exchange-rates/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/exchange-rates/{id}`

<h3 id="exchangeratescontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="exchangeratescontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ExchangeRatesController_update

<a id="opIdExchangeRatesController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/settings/exchange-rates/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/settings/exchange-rates/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "currencyName": "string",
  "buyRate": "string",
  "sellRate": "string",
  "effectiveDate": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/exchange-rates/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/settings/exchange-rates/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/settings/exchange-rates/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/settings/exchange-rates/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/exchange-rates/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/settings/exchange-rates/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/settings/exchange-rates/{id}`

> Body parameter

```json
{
  "currencyName": "string",
  "buyRate": "string",
  "sellRate": "string",
  "effectiveDate": "string"
}
```

<h3 id="exchangeratescontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateExchangeRateDto](#schemaupdateexchangeratedto)|true|none|

<h3 id="exchangeratescontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ExchangeRatesController_remove

<a id="opIdExchangeRatesController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/settings/exchange-rates/{id}

```

```http
DELETE /api/settings/exchange-rates/{id} HTTP/1.1

```

```javascript

fetch('/api/settings/exchange-rates/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/settings/exchange-rates/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/settings/exchange-rates/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/settings/exchange-rates/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/exchange-rates/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/settings/exchange-rates/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/settings/exchange-rates/{id}`

<h3 id="exchangeratescontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="exchangeratescontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-organization">Organization</h1>

## OrganizationController_get

<a id="opIdOrganizationController_get"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/organization \
  -H 'Accept: application/json'

```

```http
GET /api/settings/organization HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/settings/organization',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/settings/organization',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/settings/organization', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/organization', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/organization");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/organization", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/organization`

> Example responses

> 200 Response

```json
{}
```

<h3 id="organizationcontroller_get-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="organizationcontroller_get-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## OrganizationController_update

<a id="opIdOrganizationController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/settings/organization \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/settings/organization HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "addressLine1": "string",
  "addressLine2": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postCode": "string",
  "email": "user@example.com",
  "phone": "string",
  "website": "http://example.com",
  "companyNumber": "string",
  "taxNumber": "string",
  "logoUrl": "http://example.com",
  "bankName": "string",
  "bankAccountName": "string",
  "bankAccountNumber": "string",
  "bankSwiftBic": "string",
  "bankIban": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/organization',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/settings/organization',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/settings/organization', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/settings/organization', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/organization");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/settings/organization", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/settings/organization`

> Body parameter

```json
{
  "name": "string",
  "addressLine1": "string",
  "addressLine2": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postCode": "string",
  "email": "user@example.com",
  "phone": "string",
  "website": "http://example.com",
  "companyNumber": "string",
  "taxNumber": "string",
  "logoUrl": "http://example.com",
  "bankName": "string",
  "bankAccountName": "string",
  "bankAccountNumber": "string",
  "bankSwiftBic": "string",
  "bankIban": "string"
}
```

<h3 id="organizationcontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[UpdateOrganizationDto](#schemaupdateorganizationdto)|true|none|

<h3 id="organizationcontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-appconfig">AppConfig</h1>

## AppConfigController_get

<a id="opIdAppConfigController_get"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/app \
  -H 'Accept: application/json'

```

```http
GET /api/settings/app HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/settings/app',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/settings/app',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/settings/app', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/app', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/app");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/app", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/app`

> Example responses

> 200 Response

```json
{}
```

<h3 id="appconfigcontroller_get-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="appconfigcontroller_get-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## AppConfigController_update

<a id="opIdAppConfigController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/settings/app

```

```http
PATCH /api/settings/app HTTP/1.1

```

```javascript

fetch('/api/settings/app',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/settings/app',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/settings/app')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/settings/app', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/app");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/settings/app", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/settings/app`

<h3 id="appconfigcontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-tradingterms">TradingTerms</h1>

## TradingTermsController_findAll

<a id="opIdTradingTermsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/trading-terms

```

```http
GET /api/settings/trading-terms HTTP/1.1

```

```javascript

fetch('/api/settings/trading-terms',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/trading-terms',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/trading-terms')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/trading-terms', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/trading-terms");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/trading-terms", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/trading-terms`

<h3 id="tradingtermscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-settings">Settings</h1>

## CostCentersController_findAll

<a id="opIdCostCentersController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/cost-centers

```

```http
GET /api/settings/cost-centers HTTP/1.1

```

```javascript

fetch('/api/settings/cost-centers',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/cost-centers',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/cost-centers')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/cost-centers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/cost-centers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/cost-centers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/cost-centers`

*List all cost centers*

<h3 id="costcenterscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## CostCentersController_create

<a id="opIdCostCentersController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/settings/cost-centers \
  -H 'Content-Type: application/json'

```

```http
POST /api/settings/cost-centers HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "code": "string",
  "name": "string",
  "isActive": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/cost-centers',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/settings/cost-centers',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/settings/cost-centers', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/settings/cost-centers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/cost-centers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/settings/cost-centers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/settings/cost-centers`

*Create a new cost center*

> Body parameter

```json
{
  "code": "string",
  "name": "string",
  "isActive": true
}
```

<h3 id="costcenterscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateCostCenterDto](#schemacreatecostcenterdto)|true|none|

<h3 id="costcenterscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## CostCentersController_update

<a id="opIdCostCentersController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/settings/cost-centers/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/settings/cost-centers/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "isActive": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/cost-centers/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/settings/cost-centers/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/settings/cost-centers/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/settings/cost-centers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/cost-centers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/settings/cost-centers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/settings/cost-centers/{id}`

*Update a cost center*

> Body parameter

```json
{
  "name": "string",
  "isActive": true
}
```

<h3 id="costcenterscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateCostCenterDto](#schemaupdatecostcenterdto)|true|none|

<h3 id="costcenterscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## CostCentersController_delete

<a id="opIdCostCentersController_delete"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/settings/cost-centers/{id}

```

```http
DELETE /api/settings/cost-centers/{id} HTTP/1.1

```

```javascript

fetch('/api/settings/cost-centers/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/settings/cost-centers/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/settings/cost-centers/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/settings/cost-centers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/cost-centers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/settings/cost-centers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/settings/cost-centers/{id}`

*Delete a cost center*

<h3 id="costcenterscontroller_delete-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="costcenterscontroller_delete-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## CostCentersController_import

<a id="opIdCostCentersController_import"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/settings/cost-centers/import \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/settings/cost-centers/import HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '[
  "string"
]';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/settings/cost-centers/import',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/settings/cost-centers/import',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/settings/cost-centers/import', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/settings/cost-centers/import', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/cost-centers/import");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/settings/cost-centers/import", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/settings/cost-centers/import`

*Bulk import cost centers*

> Body parameter

```json
[
  "string"
]
```

<h3 id="costcenterscontroller_import-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|array[string]|true|none|

> Example responses

> 201 Response

```json
{
  "count": 0,
  "updated": 0
}
```

<h3 id="costcenterscontroller_import-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|[BulkImportResultDto](#schemabulkimportresultdto)|

<aside class="success">
This operation does not require authentication
</aside>

## ActivitiesController_findAll

<a id="opIdActivitiesController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/activities

```

```http
GET /api/settings/activities HTTP/1.1

```

```javascript

fetch('/api/settings/activities',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/activities',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/activities')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/activities', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/activities");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/activities", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/activities`

*List all activities*

<h3 id="activitiescontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ActivitiesController_create

<a id="opIdActivitiesController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/settings/activities \
  -H 'Content-Type: application/json'

```

```http
POST /api/settings/activities HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "code": "string",
  "name": "string",
  "isActive": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/activities',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/settings/activities',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/settings/activities', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/settings/activities', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/activities");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/settings/activities", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/settings/activities`

*Create a new activity*

> Body parameter

```json
{
  "code": "string",
  "name": "string",
  "isActive": true
}
```

<h3 id="activitiescontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateActivityDto](#schemacreateactivitydto)|true|none|

<h3 id="activitiescontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ActivitiesController_update

<a id="opIdActivitiesController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/settings/activities/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/settings/activities/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "isActive": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/settings/activities/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/settings/activities/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/settings/activities/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/settings/activities/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/activities/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/settings/activities/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/settings/activities/{id}`

*Update an activity*

> Body parameter

```json
{
  "name": "string",
  "isActive": true
}
```

<h3 id="activitiescontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateActivityDto](#schemaupdateactivitydto)|true|none|

<h3 id="activitiescontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ActivitiesController_delete

<a id="opIdActivitiesController_delete"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/settings/activities/{id}

```

```http
DELETE /api/settings/activities/{id} HTTP/1.1

```

```javascript

fetch('/api/settings/activities/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/settings/activities/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/settings/activities/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/settings/activities/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/activities/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/settings/activities/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/settings/activities/{id}`

*Delete an activity*

<h3 id="activitiescontroller_delete-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="activitiescontroller_delete-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ActivitiesController_import

<a id="opIdActivitiesController_import"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/settings/activities/import \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/settings/activities/import HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '[
  "string"
]';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/settings/activities/import',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/settings/activities/import',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/settings/activities/import', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/settings/activities/import', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/activities/import");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/settings/activities/import", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/settings/activities/import`

*Bulk import activities*

> Body parameter

```json
[
  "string"
]
```

<h3 id="activitiescontroller_import-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|array[string]|true|none|

> Example responses

> 201 Response

```json
{
  "count": 0,
  "updated": 0
}
```

<h3 id="activitiescontroller_import-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|[BulkImportResultDto](#schemabulkimportresultdto)|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-orderpicking">OrderPicking</h1>

## OrderPickingController_getPickingQueue

<a id="opIdOrderPickingController_getPickingQueue"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/picking-queue?locationId=string \
  -H 'Accept: application/json'

```

```http
GET /api/sales-orders/picking-queue?locationId=string HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/sales-orders/picking-queue?locationId=string',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/sales-orders/picking-queue',
  params: {
  'locationId' => 'string'
}, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/sales-orders/picking-queue', params={
  'locationId': 'string'
}, headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/picking-queue', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/picking-queue?locationId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/picking-queue", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/picking-queue`

<h3 id="orderpickingcontroller_getpickingqueue-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|locationId|query|string|true|none|

> Example responses

> 200 Response

```json
[
  {}
]
```

<h3 id="orderpickingcontroller_getpickingqueue-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="orderpickingcontroller_getpickingqueue-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## OrderPickingController_getPickingSummary

<a id="opIdOrderPickingController_getPickingSummary"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/picking

```

```http
GET /api/sales-orders/{id}/picking HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/picking',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/picking',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/picking')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/picking', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/picking");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/picking", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/picking`

<h3 id="orderpickingcontroller_getpickingsummary-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderpickingcontroller_getpickingsummary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderPickingController_pickLine

<a id="opIdOrderPickingController_pickLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/picking/lines/{lineId}

```

```http
POST /api/sales-orders/{id}/picking/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/picking/lines/{lineId}',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/sales-orders/{id}/picking/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/sales-orders/{id}/picking/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/picking/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/picking/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/picking/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/picking/lines/{lineId}`

<h3 id="orderpickingcontroller_pickline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="orderpickingcontroller_pickline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderPickingController_cancelPick

<a id="opIdOrderPickingController_cancelPick"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/sales-orders/{id}/picking/picks/{pickId}

```

```http
DELETE /api/sales-orders/{id}/picking/picks/{pickId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/picking/picks/{pickId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/sales-orders/{id}/picking/picks/{pickId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/sales-orders/{id}/picking/picks/{pickId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/sales-orders/{id}/picking/picks/{pickId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/picking/picks/{pickId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/sales-orders/{id}/picking/picks/{pickId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/sales-orders/{id}/picking/picks/{pickId}`

<h3 id="orderpickingcontroller_cancelpick-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|pickId|path|string|true|none|

<h3 id="orderpickingcontroller_cancelpick-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderPickingController_getShippingQueue

<a id="opIdOrderPickingController_getShippingQueue"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/shipping-queue?locationId=string \
  -H 'Accept: application/json'

```

```http
GET /api/sales-orders/shipping-queue?locationId=string HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/sales-orders/shipping-queue?locationId=string',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/sales-orders/shipping-queue',
  params: {
  'locationId' => 'string'
}, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/sales-orders/shipping-queue', params={
  'locationId': 'string'
}, headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/shipping-queue', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/shipping-queue?locationId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/shipping-queue", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/shipping-queue`

<h3 id="orderpickingcontroller_getshippingqueue-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|locationId|query|string|true|none|

> Example responses

> 200 Response

```json
[
  {}
]
```

<h3 id="orderpickingcontroller_getshippingqueue-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="orderpickingcontroller_getshippingqueue-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## OrderPickingController_getShippingContext

<a id="opIdOrderPickingController_getShippingContext"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/shipping-context

```

```http
GET /api/sales-orders/{id}/shipping-context HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/shipping-context',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/shipping-context',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/shipping-context')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/shipping-context', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipping-context");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/shipping-context", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/shipping-context`

<h3 id="orderpickingcontroller_getshippingcontext-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderpickingcontroller_getshippingcontext-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-orders">Orders</h1>

## OrdersController_findAll

<a id="opIdOrdersController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders

```

```http
GET /api/sales-orders HTTP/1.1

```

```javascript

fetch('/api/sales-orders',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders`

<h3 id="orderscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_create

<a id="opIdOrdersController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "customerId": "string",
  "customerOrderNumber": "string",
  "notes": "string",
  "fulfillmentLocationId": "string",
  "lines": [
    {
      "productId": "string",
      "productDescription": "string",
      "quantity": "string",
      "pricePerUnit": "string",
      "discountPercentage": "string",
      "taxCategoryId": "string",
      "unitOfMeasure": "string",
      "fulfillmentLocationId": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders`

> Body parameter

```json
{
  "name": "string",
  "customerId": "string",
  "customerOrderNumber": "string",
  "notes": "string",
  "fulfillmentLocationId": "string",
  "lines": [
    {
      "productId": "string",
      "productDescription": "string",
      "quantity": "string",
      "pricePerUnit": "string",
      "discountPercentage": "string",
      "taxCategoryId": "string",
      "unitOfMeasure": "string",
      "fulfillmentLocationId": "string"
    }
  ]
}
```

<h3 id="orderscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateOrderDto](#schemacreateorderdto)|true|none|

<h3 id="orderscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_findOne

<a id="opIdOrdersController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}

```

```http
GET /api/sales-orders/{id} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}`

<h3 id="orderscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_update

<a id="opIdOrdersController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/sales-orders/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "customerOrderNumber": "string",
  "notes": "string",
  "fulfillmentLocationId": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/sales-orders/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/sales-orders/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}`

> Body parameter

```json
{
  "name": "string",
  "customerOrderNumber": "string",
  "notes": "string",
  "fulfillmentLocationId": "string"
}
```

<h3 id="orderscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateOrderDto](#schemaupdateorderdto)|true|none|

<h3 id="orderscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_changeState

<a id="opIdOrdersController_changeState"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/state

```

```http
PATCH /api/sales-orders/{id}/state HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/state',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/sales-orders/{id}/state',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/sales-orders/{id}/state')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/state', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/state");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/state", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/state`

<h3 id="orderscontroller_changestate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderscontroller_changestate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_archive

<a id="opIdOrdersController_archive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/archive

```

```http
POST /api/sales-orders/{id}/archive HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/archive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/sales-orders/{id}/archive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/sales-orders/{id}/archive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/archive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/archive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/archive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/archive`

<h3 id="orderscontroller_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderscontroller_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_unarchive

<a id="opIdOrdersController_unarchive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/unarchive

```

```http
POST /api/sales-orders/{id}/unarchive HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/unarchive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/sales-orders/{id}/unarchive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/sales-orders/{id}/unarchive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/unarchive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/unarchive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/unarchive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/unarchive`

<h3 id="orderscontroller_unarchive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderscontroller_unarchive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_addLine

<a id="opIdOrdersController_addLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/lines \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/sales-orders/{id}/lines HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/sales-orders/{id}/lines',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/lines',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/lines', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/lines`

> Body parameter

```json
{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}
```

<h3 id="orderscontroller_addline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateOrderLineDto](#schemacreateorderlinedto)|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="orderscontroller_addline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="orderscontroller_addline-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_updateLine

<a id="opIdOrdersController_updateLine"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/lines/{lineId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/sales-orders/{id}/lines/{lineId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "productDescription": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/lines/{lineId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/sales-orders/{id}/lines/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/sales-orders/{id}/lines/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/lines/{lineId}`

> Body parameter

```json
{
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "productDescription": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}
```

<h3 id="orderscontroller_updateline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|
|body|body|[UpdateOrderLineDto](#schemaupdateorderlinedto)|true|none|

<h3 id="orderscontroller_updateline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_removeLine

<a id="opIdOrdersController_removeLine"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/sales-orders/{id}/lines/{lineId}

```

```http
DELETE /api/sales-orders/{id}/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/lines/{lineId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/sales-orders/{id}/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/sales-orders/{id}/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/sales-orders/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/sales-orders/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/sales-orders/{id}/lines/{lineId}`

<h3 id="orderscontroller_removeline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="orderscontroller_removeline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrdersController_addPostConfirmationLine

<a id="opIdOrdersController_addPostConfirmationLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/post-confirmation-lines \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/sales-orders/{id}/post-confirmation-lines HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/sales-orders/{id}/post-confirmation-lines',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/post-confirmation-lines',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/post-confirmation-lines', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/post-confirmation-lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/post-confirmation-lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/post-confirmation-lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/post-confirmation-lines`

> Body parameter

```json
{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}
```

<h3 id="orderscontroller_addpostconfirmationline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateOrderLineDto](#schemacreateorderlinedto)|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="orderscontroller_addpostconfirmationline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="orderscontroller_addpostconfirmationline-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-orderreturns">OrderReturns</h1>

## OrderReturnsController_createReturn

<a id="opIdOrderReturnsController_createReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/returns \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders/{id}/returns HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "notes": "string",
  "lines": [
    {
      "salesOrderLineId": "string",
      "quantityReturned": "string",
      "reason": "string",
      "returnFee": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/returns',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/returns',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/returns', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/returns', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/returns", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/returns`

> Body parameter

```json
{
  "notes": "string",
  "lines": [
    {
      "salesOrderLineId": "string",
      "quantityReturned": "string",
      "reason": "string",
      "returnFee": "string"
    }
  ]
}
```

<h3 id="orderreturnscontroller_createreturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateReturnDto](#schemacreatereturndto)|true|none|

<h3 id="orderreturnscontroller_createreturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_findReturns

<a id="opIdOrderReturnsController_findReturns"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/returns

```

```http
GET /api/sales-orders/{id}/returns HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/returns',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/returns',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/returns')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/returns', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/returns", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/returns`

<h3 id="orderreturnscontroller_findreturns-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="orderreturnscontroller_findreturns-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_findReturn

<a id="opIdOrderReturnsController_findReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/returns/{returnId}

```

```http
GET /api/sales-orders/{id}/returns/{returnId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/returns/{returnId}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/returns/{returnId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/returns/{returnId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/returns/{returnId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/returns/{returnId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/returns/{returnId}`

<h3 id="orderreturnscontroller_findreturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|

<h3 id="orderreturnscontroller_findreturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_updateReturn

<a id="opIdOrderReturnsController_updateReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/returns/{returnId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/sales-orders/{id}/returns/{returnId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "notes": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/returns/{returnId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/sales-orders/{id}/returns/{returnId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/sales-orders/{id}/returns/{returnId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/returns/{returnId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/returns/{returnId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/returns/{returnId}`

> Body parameter

```json
{
  "notes": "string"
}
```

<h3 id="orderreturnscontroller_updatereturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|
|body|body|[UpdateReturnDto](#schemaupdatereturndto)|true|none|

<h3 id="orderreturnscontroller_updatereturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_changeReturnState

<a id="opIdOrderReturnsController_changeReturnState"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/returns/{returnId}/state

```

```http
PATCH /api/sales-orders/{id}/returns/{returnId}/state HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/returns/{returnId}/state',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/sales-orders/{id}/returns/{returnId}/state',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/sales-orders/{id}/returns/{returnId}/state')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/returns/{returnId}/state', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}/state");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/returns/{returnId}/state", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/returns/{returnId}/state`

<h3 id="orderreturnscontroller_changereturnstate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|

<h3 id="orderreturnscontroller_changereturnstate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_addReturnLine

<a id="opIdOrderReturnsController_addReturnLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/returns/{returnId}/lines \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders/{id}/returns/{returnId}/lines HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "salesOrderLineId": "string",
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/returns/{returnId}/lines',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/returns/{returnId}/lines',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/returns/{returnId}/lines', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/returns/{returnId}/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}/lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/returns/{returnId}/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/returns/{returnId}/lines`

> Body parameter

```json
{
  "salesOrderLineId": "string",
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}
```

<h3 id="orderreturnscontroller_addreturnline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|
|body|body|[AddReturnLineDto](#schemaaddreturnlinedto)|true|none|

<h3 id="orderreturnscontroller_addreturnline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_updateReturnLine

<a id="opIdOrderReturnsController_updateReturnLine"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/returns/{returnId}/lines/{lineId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/sales-orders/{id}/returns/{returnId}/lines/{lineId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/returns/{returnId}/lines/{lineId}`

> Body parameter

```json
{
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}
```

<h3 id="orderreturnscontroller_updatereturnline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|
|lineId|path|string|true|none|
|body|body|[UpdateReturnLineDto](#schemaupdatereturnlinedto)|true|none|

<h3 id="orderreturnscontroller_updatereturnline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_removeReturnLine

<a id="opIdOrderReturnsController_removeReturnLine"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/sales-orders/{id}/returns/{returnId}/lines/{lineId}

```

```http
DELETE /api/sales-orders/{id}/returns/{returnId}/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/sales-orders/{id}/returns/{returnId}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/sales-orders/{id}/returns/{returnId}/lines/{lineId}`

<h3 id="orderreturnscontroller_removereturnline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="orderreturnscontroller_removereturnline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderReturnsController_receiveReturn

<a id="opIdOrderReturnsController_receiveReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/returns/{returnId}/receive \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders/{id}/returns/{returnId}/receive HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "locationId": "string",
  "lines": [
    {
      "returnLineId": "string",
      "quantityReceived": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/returns/{returnId}/receive',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/returns/{returnId}/receive',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/returns/{returnId}/receive', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/returns/{returnId}/receive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/returns/{returnId}/receive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/returns/{returnId}/receive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/returns/{returnId}/receive`

> Body parameter

```json
{
  "locationId": "string",
  "lines": [
    {
      "returnLineId": "string",
      "quantityReceived": "string"
    }
  ]
}
```

<h3 id="orderreturnscontroller_receivereturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|
|body|body|[ReceiveReturnDto](#schemareceivereturndto)|true|none|

<h3 id="orderreturnscontroller_receivereturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-ordershipments">OrderShipments</h1>

## OrderShipmentsController_createShipment

<a id="opIdOrderShipmentsController_createShipment"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/shipments \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders/{id}/shipments HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "notes": "string",
  "trackingNumber": "string",
  "lines": [
    {
      "salesOrderLineId": "string",
      "quantityShipped": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/shipments',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/shipments',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/shipments', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/shipments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/shipments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/shipments`

> Body parameter

```json
{
  "notes": "string",
  "trackingNumber": "string",
  "lines": [
    {
      "salesOrderLineId": "string",
      "quantityShipped": "string"
    }
  ]
}
```

<h3 id="ordershipmentscontroller_createshipment-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateShipmentDto](#schemacreateshipmentdto)|true|none|

<h3 id="ordershipmentscontroller_createshipment-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_findShipments

<a id="opIdOrderShipmentsController_findShipments"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/shipments

```

```http
GET /api/sales-orders/{id}/shipments HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/shipments',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/shipments',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/shipments')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/shipments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/shipments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/shipments`

<h3 id="ordershipmentscontroller_findshipments-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="ordershipmentscontroller_findshipments-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_findShipment

<a id="opIdOrderShipmentsController_findShipment"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/shipments/{shipmentId}

```

```http
GET /api/sales-orders/{id}/shipments/{shipmentId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/shipments/{shipmentId}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/shipments/{shipmentId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/shipments/{shipmentId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/shipments/{shipmentId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/shipments/{shipmentId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/shipments/{shipmentId}`

<h3 id="ordershipmentscontroller_findshipment-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|

<h3 id="ordershipmentscontroller_findshipment-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_updateShipment

<a id="opIdOrderShipmentsController_updateShipment"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/shipments/{shipmentId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/sales-orders/{id}/shipments/{shipmentId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "notes": "string",
  "trackingNumber": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/shipments/{shipmentId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/sales-orders/{id}/shipments/{shipmentId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/sales-orders/{id}/shipments/{shipmentId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/shipments/{shipmentId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/shipments/{shipmentId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/shipments/{shipmentId}`

> Body parameter

```json
{
  "notes": "string",
  "trackingNumber": "string"
}
```

<h3 id="ordershipmentscontroller_updateshipment-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|
|body|body|[UpdateShipmentDto](#schemaupdateshipmentdto)|true|none|

<h3 id="ordershipmentscontroller_updateshipment-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_changeShipmentState

<a id="opIdOrderShipmentsController_changeShipmentState"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/shipments/{shipmentId}/state

```

```http
PATCH /api/sales-orders/{id}/shipments/{shipmentId}/state HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/shipments/{shipmentId}/state',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/sales-orders/{id}/shipments/{shipmentId}/state',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/sales-orders/{id}/shipments/{shipmentId}/state')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/shipments/{shipmentId}/state', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}/state");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/shipments/{shipmentId}/state", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/shipments/{shipmentId}/state`

<h3 id="ordershipmentscontroller_changeshipmentstate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|

<h3 id="ordershipmentscontroller_changeshipmentstate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_cancelShipment

<a id="opIdOrderShipmentsController_cancelShipment"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/shipments/{shipmentId}/cancel

```

```http
POST /api/sales-orders/{id}/shipments/{shipmentId}/cancel HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/shipments/{shipmentId}/cancel',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/sales-orders/{id}/shipments/{shipmentId}/cancel',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/sales-orders/{id}/shipments/{shipmentId}/cancel')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/shipments/{shipmentId}/cancel', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}/cancel");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/shipments/{shipmentId}/cancel", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/shipments/{shipmentId}/cancel`

<h3 id="ordershipmentscontroller_cancelshipment-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|

<h3 id="ordershipmentscontroller_cancelshipment-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_addShipmentLine

<a id="opIdOrderShipmentsController_addShipmentLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/shipments/{shipmentId}/lines \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders/{id}/shipments/{shipmentId}/lines HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "salesOrderLineId": "string",
  "quantityShipped": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/shipments/{shipmentId}/lines',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/shipments/{shipmentId}/lines',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/shipments/{shipmentId}/lines', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/shipments/{shipmentId}/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}/lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/shipments/{shipmentId}/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/shipments/{shipmentId}/lines`

> Body parameter

```json
{
  "salesOrderLineId": "string",
  "quantityShipped": "string"
}
```

<h3 id="ordershipmentscontroller_addshipmentline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|
|body|body|[AddShipmentLineDto](#schemaaddshipmentlinedto)|true|none|

<h3 id="ordershipmentscontroller_addshipmentline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_updateShipmentLine

<a id="opIdOrderShipmentsController_updateShipmentLine"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "quantityShipped": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}`

> Body parameter

```json
{
  "quantityShipped": "string"
}
```

<h3 id="ordershipmentscontroller_updateshipmentline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|
|lineId|path|string|true|none|
|body|body|[UpdateShipmentLineDto](#schemaupdateshipmentlinedto)|true|none|

<h3 id="ordershipmentscontroller_updateshipmentline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## OrderShipmentsController_removeShipmentLine

<a id="opIdOrderShipmentsController_removeShipmentLine"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}

```

```http
DELETE /api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}`

<h3 id="ordershipmentscontroller_removeshipmentline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|shipmentId|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="ordershipmentscontroller_removeshipmentline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-globalshipments">GlobalShipments</h1>

## GlobalShipmentsController_findAll

<a id="opIdGlobalShipmentsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/shipments?days=string&salesOrderId=string&limit=string

```

```http
GET /api/shipments?days=string&salesOrderId=string&limit=string HTTP/1.1

```

```javascript

fetch('/api/shipments?days=string&salesOrderId=string&limit=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/shipments',
  params: {
  'days' => 'string',
'salesOrderId' => 'string',
'limit' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/shipments', params={
  'days': 'string',  'salesOrderId': 'string',  'limit': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/shipments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/shipments?days=string&salesOrderId=string&limit=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/shipments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/shipments`

<h3 id="globalshipmentscontroller_findall-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|days|query|string|true|none|
|salesOrderId|query|string|true|none|
|limit|query|string|true|none|

<h3 id="globalshipmentscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlobalShipmentsController_findOne

<a id="opIdGlobalShipmentsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/shipments/{id}

```

```http
GET /api/shipments/{id} HTTP/1.1

```

```javascript

fetch('/api/shipments/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/shipments/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/shipments/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/shipments/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/shipments/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/shipments/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/shipments/{id}`

<h3 id="globalshipmentscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="globalshipmentscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-globalreturns">GlobalReturns</h1>

## GlobalReturnsController_findGlobalReturns

<a id="opIdGlobalReturnsController_findGlobalReturns"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-returns?stateCode=string

```

```http
GET /api/sales-returns?stateCode=string HTTP/1.1

```

```javascript

fetch('/api/sales-returns?stateCode=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-returns',
  params: {
  'stateCode' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-returns', params={
  'stateCode': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-returns', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-returns?stateCode=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-returns", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-returns`

<h3 id="globalreturnscontroller_findglobalreturns-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|stateCode|query|string|true|none|

<h3 id="globalreturnscontroller_findglobalreturns-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-allocations">Allocations</h1>

## AllocationsController_getOpenDemands

<a id="opIdAllocationsController_getOpenDemands"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/allocations/open

```

```http
GET /api/allocations/open HTTP/1.1

```

```javascript

fetch('/api/allocations/open',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/allocations/open',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/allocations/open')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/allocations/open', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/open");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/allocations/open", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/allocations/open`

<h3 id="allocationscontroller_getopendemands-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_getAllocationsByPo

<a id="opIdAllocationsController_getAllocationsByPo"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/allocations/by-po/{poId}

```

```http
GET /api/allocations/by-po/{poId} HTTP/1.1

```

```javascript

fetch('/api/allocations/by-po/{poId}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/allocations/by-po/{poId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/allocations/by-po/{poId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/allocations/by-po/{poId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/by-po/{poId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/allocations/by-po/{poId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/allocations/by-po/{poId}`

<h3 id="allocationscontroller_getallocationsbypo-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|poId|path|string|true|none|

<h3 id="allocationscontroller_getallocationsbypo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_getAvailablePoLines

<a id="opIdAllocationsController_getAvailablePoLines"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/allocations/available-po-lines?productId=string

```

```http
GET /api/allocations/available-po-lines?productId=string HTTP/1.1

```

```javascript

fetch('/api/allocations/available-po-lines?productId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/allocations/available-po-lines',
  params: {
  'productId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/allocations/available-po-lines', params={
  'productId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/allocations/available-po-lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/available-po-lines?productId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/allocations/available-po-lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/allocations/available-po-lines`

<h3 id="allocationscontroller_getavailablepolines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productId|query|string|true|none|

<h3 id="allocationscontroller_getavailablepolines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_linkDemandToPo

<a id="opIdAllocationsController_linkDemandToPo"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/allocations/link-po

```

```http
POST /api/allocations/link-po HTTP/1.1

```

```javascript

fetch('/api/allocations/link-po',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/allocations/link-po',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/allocations/link-po')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/allocations/link-po', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/link-po");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/allocations/link-po", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/allocations/link-po`

<h3 id="allocationscontroller_linkdemandtopo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_resolveOpenDemands

<a id="opIdAllocationsController_resolveOpenDemands"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/allocations/resolve

```

```http
POST /api/allocations/resolve HTTP/1.1

```

```javascript

fetch('/api/allocations/resolve',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/allocations/resolve',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/allocations/resolve')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/allocations/resolve', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/resolve");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/allocations/resolve", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/allocations/resolve`

<h3 id="allocationscontroller_resolveopendemands-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_unlinkDemand

<a id="opIdAllocationsController_unlinkDemand"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/allocations/{id}/unlink

```

```http
POST /api/allocations/{id}/unlink HTTP/1.1

```

```javascript

fetch('/api/allocations/{id}/unlink',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/allocations/{id}/unlink',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/allocations/{id}/unlink')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/allocations/{id}/unlink', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/{id}/unlink");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/allocations/{id}/unlink", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/allocations/{id}/unlink`

<h3 id="allocationscontroller_unlinkdemand-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="allocationscontroller_unlinkdemand-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_reallocateDemand

<a id="opIdAllocationsController_reallocateDemand"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/allocations/{id}/reallocate

```

```http
POST /api/allocations/{id}/reallocate HTTP/1.1

```

```javascript

fetch('/api/allocations/{id}/reallocate',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/allocations/{id}/reallocate',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/allocations/{id}/reallocate')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/allocations/{id}/reallocate', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/{id}/reallocate");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/allocations/{id}/reallocate", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/allocations/{id}/reallocate`

<h3 id="allocationscontroller_reallocatedemand-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="allocationscontroller_reallocatedemand-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_generatePOs

<a id="opIdAllocationsController_generatePOs"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/allocations/generate-pos

```

```http
POST /api/allocations/generate-pos HTTP/1.1

```

```javascript

fetch('/api/allocations/generate-pos',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/allocations/generate-pos',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/allocations/generate-pos')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/allocations/generate-pos', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/generate-pos");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/allocations/generate-pos", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/allocations/generate-pos`

<h3 id="allocationscontroller_generatepos-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## AllocationsController_generateTransfers

<a id="opIdAllocationsController_generateTransfers"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/allocations/generate-transfers

```

```http
POST /api/allocations/generate-transfers HTTP/1.1

```

```javascript

fetch('/api/allocations/generate-transfers',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/allocations/generate-transfers',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/allocations/generate-transfers')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/allocations/generate-transfers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/allocations/generate-transfers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/allocations/generate-transfers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/allocations/generate-transfers`

<h3 id="allocationscontroller_generatetransfers-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-transfers">Transfers</h1>

## TransfersController_createTransferFromDemands

<a id="opIdTransfersController_createTransferFromDemands"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers/from-demands

```

```http
POST /api/transfers/from-demands HTTP/1.1

```

```javascript

fetch('/api/transfers/from-demands',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/transfers/from-demands',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/transfers/from-demands')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers/from-demands', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/from-demands");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers/from-demands", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers/from-demands`

<h3 id="transferscontroller_createtransferfromdemands-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_findEvents

<a id="opIdTransfersController_findEvents"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/transfers/{id}/events

```

```http
GET /api/transfers/{id}/events HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/events',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/transfers/{id}/events',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/transfers/{id}/events')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/transfers/{id}/events', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/events");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/transfers/{id}/events", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/transfers/{id}/events`

<h3 id="transferscontroller_findevents-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="transferscontroller_findevents-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_getPickingSummary

<a id="opIdTransfersController_getPickingSummary"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/transfers/{id}/picking

```

```http
GET /api/transfers/{id}/picking HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/picking',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/transfers/{id}/picking',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/transfers/{id}/picking')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/transfers/{id}/picking', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/picking");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/transfers/{id}/picking", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/transfers/{id}/picking`

<h3 id="transferscontroller_getpickingsummary-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="transferscontroller_getpickingsummary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_pickLine

<a id="opIdTransfersController_pickLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers/{id}/picking/lines/{lineId}

```

```http
POST /api/transfers/{id}/picking/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/picking/lines/{lineId}',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/transfers/{id}/picking/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/transfers/{id}/picking/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers/{id}/picking/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/picking/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers/{id}/picking/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers/{id}/picking/lines/{lineId}`

<h3 id="transferscontroller_pickline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="transferscontroller_pickline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_cancelPick

<a id="opIdTransfersController_cancelPick"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/transfers/{id}/picking/picks/{pickId}

```

```http
DELETE /api/transfers/{id}/picking/picks/{pickId} HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/picking/picks/{pickId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/transfers/{id}/picking/picks/{pickId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/transfers/{id}/picking/picks/{pickId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/transfers/{id}/picking/picks/{pickId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/picking/picks/{pickId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/transfers/{id}/picking/picks/{pickId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/transfers/{id}/picking/picks/{pickId}`

<h3 id="transferscontroller_cancelpick-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|pickId|path|string|true|none|

<h3 id="transferscontroller_cancelpick-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_shipTransferOrder

<a id="opIdTransfersController_shipTransferOrder"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers/{id}/ship

```

```http
POST /api/transfers/{id}/ship HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/ship',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/transfers/{id}/ship',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/transfers/{id}/ship')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers/{id}/ship', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/ship");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers/{id}/ship", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers/{id}/ship`

<h3 id="transferscontroller_shiptransferorder-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="transferscontroller_shiptransferorder-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_receiveTransferOrder

<a id="opIdTransfersController_receiveTransferOrder"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers/{id}/receive

```

```http
POST /api/transfers/{id}/receive HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/receive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/transfers/{id}/receive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/transfers/{id}/receive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers/{id}/receive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/receive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers/{id}/receive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers/{id}/receive`

<h3 id="transferscontroller_receivetransferorder-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="transferscontroller_receivetransferorder-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_cancelTransferOrder

<a id="opIdTransfersController_cancelTransferOrder"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers/{id}/cancel

```

```http
POST /api/transfers/{id}/cancel HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/cancel',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/transfers/{id}/cancel',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/transfers/{id}/cancel')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers/{id}/cancel', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/cancel");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers/{id}/cancel", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers/{id}/cancel`

<h3 id="transferscontroller_canceltransferorder-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="transferscontroller_canceltransferorder-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_findAll

<a id="opIdTransfersController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/transfers

```

```http
GET /api/transfers HTTP/1.1

```

```javascript

fetch('/api/transfers',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/transfers',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/transfers')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/transfers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/transfers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/transfers`

<h3 id="transferscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_create

<a id="opIdTransfersController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers \
  -H 'Content-Type: application/json'

```

```http
POST /api/transfers HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "sourceLocationId": "string",
  "destinationLocationId": "string",
  "notes": "string",
  "lines": [
    {
      "productId": "string",
      "quantity": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/transfers',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/transfers',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/transfers', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers`

> Body parameter

```json
{
  "sourceLocationId": "string",
  "destinationLocationId": "string",
  "notes": "string",
  "lines": [
    {
      "productId": "string",
      "quantity": "string"
    }
  ]
}
```

<h3 id="transferscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateTransferOrderDto](#schemacreatetransferorderdto)|true|none|

<h3 id="transferscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_findOne

<a id="opIdTransfersController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/transfers/{id}

```

```http
GET /api/transfers/{id} HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/transfers/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/transfers/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/transfers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/transfers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/transfers/{id}`

<h3 id="transferscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="transferscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_update

<a id="opIdTransfersController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/transfers/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/transfers/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "sourceLocationId": "string",
  "destinationLocationId": "string",
  "notes": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/transfers/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/transfers/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/transfers/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/transfers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/transfers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/transfers/{id}`

> Body parameter

```json
{
  "sourceLocationId": "string",
  "destinationLocationId": "string",
  "notes": "string"
}
```

<h3 id="transferscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateTransferOrderDto](#schemaupdatetransferorderdto)|true|none|

<h3 id="transferscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_addLine

<a id="opIdTransfersController_addLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/transfers/{id}/lines \
  -H 'Content-Type: application/json'

```

```http
POST /api/transfers/{id}/lines HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "productId": "string",
  "quantity": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/transfers/{id}/lines',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/transfers/{id}/lines',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/transfers/{id}/lines', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/transfers/{id}/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/transfers/{id}/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/transfers/{id}/lines`

> Body parameter

```json
{
  "productId": "string",
  "quantity": "string"
}
```

<h3 id="transferscontroller_addline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateTransferOrderLineDto](#schemacreatetransferorderlinedto)|true|none|

<h3 id="transferscontroller_addline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_updateLine

<a id="opIdTransfersController_updateLine"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/transfers/{id}/lines/{lineId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/transfers/{id}/lines/{lineId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "quantity": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/transfers/{id}/lines/{lineId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/transfers/{id}/lines/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/transfers/{id}/lines/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/transfers/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/transfers/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/transfers/{id}/lines/{lineId}`

> Body parameter

```json
{
  "quantity": "string"
}
```

<h3 id="transferscontroller_updateline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|
|body|body|[UpdateTransferOrderLineDto](#schemaupdatetransferorderlinedto)|true|none|

<h3 id="transferscontroller_updateline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TransfersController_removeLine

<a id="opIdTransfersController_removeLine"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/transfers/{id}/lines/{lineId}

```

```http
DELETE /api/transfers/{id}/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/transfers/{id}/lines/{lineId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/transfers/{id}/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/transfers/{id}/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/transfers/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/transfers/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/transfers/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/transfers/{id}/lines/{lineId}`

<h3 id="transferscontroller_removeline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="transferscontroller_removeline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-taxcategories">TaxCategories</h1>

## TaxCategoriesController_findAll

<a id="opIdTaxCategoriesController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/tax-categories

```

```http
GET /api/tax-categories HTTP/1.1

```

```javascript

fetch('/api/tax-categories',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/tax-categories',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/tax-categories')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/tax-categories', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/tax-categories");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/tax-categories", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/tax-categories`

<h3 id="taxcategoriescontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TaxCategoriesController_create

<a id="opIdTaxCategoriesController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/tax-categories \
  -H 'Content-Type: application/json'

```

```http
POST /api/tax-categories HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "code": "string",
  "title": "string",
  "type": {},
  "rate": "string",
  "isDefault": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/tax-categories',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/tax-categories',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/tax-categories', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/tax-categories', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/tax-categories");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/tax-categories", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/tax-categories`

> Body parameter

```json
{
  "code": "string",
  "title": "string",
  "type": {},
  "rate": "string",
  "isDefault": true
}
```

<h3 id="taxcategoriescontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateTaxCategoryDto](#schemacreatetaxcategorydto)|true|none|

<h3 id="taxcategoriescontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TaxCategoriesController_findOne

<a id="opIdTaxCategoriesController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/tax-categories/{id}

```

```http
GET /api/tax-categories/{id} HTTP/1.1

```

```javascript

fetch('/api/tax-categories/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/tax-categories/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/tax-categories/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/tax-categories/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/tax-categories/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/tax-categories/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/tax-categories/{id}`

<h3 id="taxcategoriescontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="taxcategoriescontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TaxCategoriesController_update

<a id="opIdTaxCategoriesController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/tax-categories/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/tax-categories/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "code": "string",
  "title": "string",
  "type": {},
  "rate": "string",
  "isDefault": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/tax-categories/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/tax-categories/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/tax-categories/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/tax-categories/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/tax-categories/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/tax-categories/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/tax-categories/{id}`

> Body parameter

```json
{
  "code": "string",
  "title": "string",
  "type": {},
  "rate": "string",
  "isDefault": true
}
```

<h3 id="taxcategoriescontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateTaxCategoryDto](#schemaupdatetaxcategorydto)|true|none|

<h3 id="taxcategoriescontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## TaxCategoriesController_remove

<a id="opIdTaxCategoriesController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/tax-categories/{id}

```

```http
DELETE /api/tax-categories/{id} HTTP/1.1

```

```javascript

fetch('/api/tax-categories/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/tax-categories/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/tax-categories/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/tax-categories/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/tax-categories/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/tax-categories/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/tax-categories/{id}`

<h3 id="taxcategoriescontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="taxcategoriescontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-reports">Reports</h1>

## ReportsController_runHook

<a id="opIdReportsController_runHook"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/reports/hooks/{hookSlug}/run?id=string&context=string

```

```http
POST /api/reports/hooks/{hookSlug}/run?id=string&context=string HTTP/1.1

```

```javascript

fetch('/api/reports/hooks/{hookSlug}/run?id=string&context=string',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/reports/hooks/{hookSlug}/run',
  params: {
  'id' => 'string',
'context' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/reports/hooks/{hookSlug}/run', params={
  'id': 'string',  'context': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/reports/hooks/{hookSlug}/run', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/hooks/{hookSlug}/run?id=string&context=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/reports/hooks/{hookSlug}/run", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/reports/hooks/{hookSlug}/run`

<h3 id="reportscontroller_runhook-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|hookSlug|path|string|true|none|
|id|query|string|true|none|
|context|query|string|true|none|

<h3 id="reportscontroller_runhook-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_getHooks

<a id="opIdReportsController_getHooks"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/reports/hooks

```

```http
GET /api/reports/hooks HTTP/1.1

```

```javascript

fetch('/api/reports/hooks',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/reports/hooks',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/reports/hooks')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/reports/hooks', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/hooks");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/reports/hooks", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/reports/hooks`

<h3 id="reportscontroller_gethooks-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_getAssignments

<a id="opIdReportsController_getAssignments"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/reports/hook-assignments

```

```http
GET /api/reports/hook-assignments HTTP/1.1

```

```javascript

fetch('/api/reports/hook-assignments',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/reports/hook-assignments',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/reports/hook-assignments')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/reports/hook-assignments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/hook-assignments");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/reports/hook-assignments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/reports/hook-assignments`

<h3 id="reportscontroller_getassignments-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_updateAssignment

<a id="opIdReportsController_updateAssignment"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/reports/hook-assignments/{hook}

```

```http
PATCH /api/reports/hook-assignments/{hook} HTTP/1.1

```

```javascript

fetch('/api/reports/hook-assignments/{hook}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/reports/hook-assignments/{hook}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/reports/hook-assignments/{hook}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/reports/hook-assignments/{hook}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/hook-assignments/{hook}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/reports/hook-assignments/{hook}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/reports/hook-assignments/{hook}`

<h3 id="reportscontroller_updateassignment-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|hook|path|string|true|none|

<h3 id="reportscontroller_updateassignment-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_getRandomId

<a id="opIdReportsController_getRandomId"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/reports/hooks/{slug}/random-id

```

```http
GET /api/reports/hooks/{slug}/random-id HTTP/1.1

```

```javascript

fetch('/api/reports/hooks/{slug}/random-id',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/reports/hooks/{slug}/random-id',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/reports/hooks/{slug}/random-id')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/reports/hooks/{slug}/random-id', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/hooks/{slug}/random-id");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/reports/hooks/{slug}/random-id", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/reports/hooks/{slug}/random-id`

<h3 id="reportscontroller_getrandomid-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|slug|path|string|true|none|

<h3 id="reportscontroller_getrandomid-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_getAllReports

<a id="opIdReportsController_getAllReports"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/reports

```

```http
GET /api/reports HTTP/1.1

```

```javascript

fetch('/api/reports',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/reports',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/reports')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/reports', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/reports", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/reports`

<h3 id="reportscontroller_getallreports-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_createReport

<a id="opIdReportsController_createReport"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/reports

```

```http
POST /api/reports HTTP/1.1

```

```javascript

fetch('/api/reports',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/reports',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/reports')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/reports', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/reports", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/reports`

<h3 id="reportscontroller_createreport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_getReport

<a id="opIdReportsController_getReport"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/reports/{id}

```

```http
GET /api/reports/{id} HTTP/1.1

```

```javascript

fetch('/api/reports/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/reports/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/reports/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/reports/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/reports/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/reports/{id}`

<h3 id="reportscontroller_getreport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reportscontroller_getreport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_updateReport

<a id="opIdReportsController_updateReport"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/reports/{id}

```

```http
PATCH /api/reports/{id} HTTP/1.1

```

```javascript

fetch('/api/reports/{id}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/reports/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/reports/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/reports/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/reports/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/reports/{id}`

<h3 id="reportscontroller_updatereport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reportscontroller_updatereport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_deleteReport

<a id="opIdReportsController_deleteReport"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/reports/{id}

```

```http
DELETE /api/reports/{id} HTTP/1.1

```

```javascript

fetch('/api/reports/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/reports/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/reports/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/reports/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/reports/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/reports/{id}`

<h3 id="reportscontroller_deletereport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="reportscontroller_deletereport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ReportsController_preview

<a id="opIdReportsController_preview"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/reports/preview

```

```http
POST /api/reports/preview HTTP/1.1

```

```javascript

fetch('/api/reports/preview',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/reports/preview',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/reports/preview')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/reports/preview', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/reports/preview");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/reports/preview", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/reports/preview`

<h3 id="reportscontroller_preview-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-salesinvoice">SalesInvoice</h1>

## SalesInvoiceController_createSalesInvoice

<a id="opIdSalesInvoiceController_createSalesInvoice"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/sales-orders/{id}/invoice \
  -H 'Content-Type: application/json'

```

```http
POST /api/sales-orders/{id}/invoice HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "notes": "string",
  "lines": [
    {
      "salesOrderLineId": "c841d696-011a-47e7-96c4-3081b0e83472",
      "quantityToInvoice": 0
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/sales-orders/{id}/invoice',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/sales-orders/{id}/invoice',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/sales-orders/{id}/invoice', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/sales-orders/{id}/invoice', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/invoice");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/sales-orders/{id}/invoice", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/sales-orders/{id}/invoice`

> Body parameter

```json
{
  "notes": "string",
  "lines": [
    {
      "salesOrderLineId": "c841d696-011a-47e7-96c4-3081b0e83472",
      "quantityToInvoice": 0
    }
  ]
}
```

<h3 id="salesinvoicecontroller_createsalesinvoice-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateSalesInvoiceDto](#schemacreatesalesinvoicedto)|true|none|

<h3 id="salesinvoicecontroller_createsalesinvoice-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SalesInvoiceController_getSalesInvoices

<a id="opIdSalesInvoiceController_getSalesInvoices"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-orders/{id}/invoices

```

```http
GET /api/sales-orders/{id}/invoices HTTP/1.1

```

```javascript

fetch('/api/sales-orders/{id}/invoices',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-orders/{id}/invoices',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-orders/{id}/invoices')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-orders/{id}/invoices', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-orders/{id}/invoices");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-orders/{id}/invoices", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-orders/{id}/invoices`

<h3 id="salesinvoicecontroller_getsalesinvoices-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="salesinvoicecontroller_getsalesinvoices-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-purchaseinvoice">PurchaseInvoice</h1>

## PurchaseInvoiceController_getPurchaseBills

<a id="opIdPurchaseInvoiceController_getPurchaseBills"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders/{id}/invoices

```

```http
GET /api/purchase-orders/{id}/invoices HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/{id}/invoices',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-orders/{id}/invoices',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-orders/{id}/invoices')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders/{id}/invoices', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/invoices");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders/{id}/invoices", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders/{id}/invoices`

<h3 id="purchaseinvoicecontroller_getpurchasebills-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="purchaseinvoicecontroller_getpurchasebills-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-invoicedetail">InvoiceDetail</h1>

## InvoiceDetailController_getSalesInvoiceDetails

<a id="opIdInvoiceDetailController_getSalesInvoiceDetails"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-invoices/{id}

```

```http
GET /api/sales-invoices/{id} HTTP/1.1

```

```javascript

fetch('/api/sales-invoices/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-invoices/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-invoices/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-invoices/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-invoices/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-invoices/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-invoices/{id}`

<h3 id="invoicedetailcontroller_getsalesinvoicedetails-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="invoicedetailcontroller_getsalesinvoicedetails-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_getSalesInvoicesGlobal

<a id="opIdInvoiceDetailController_getSalesInvoicesGlobal"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/sales-invoices?days=string&customerId=string&invoiceId=string&limit=string

```

```http
GET /api/sales-invoices?days=string&customerId=string&invoiceId=string&limit=string HTTP/1.1

```

```javascript

fetch('/api/sales-invoices?days=string&customerId=string&invoiceId=string&limit=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/sales-invoices',
  params: {
  'days' => 'string',
'customerId' => 'string',
'invoiceId' => 'string',
'limit' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/sales-invoices', params={
  'days': 'string',  'customerId': 'string',  'invoiceId': 'string',  'limit': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/sales-invoices', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/sales-invoices?days=string&customerId=string&invoiceId=string&limit=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/sales-invoices", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/sales-invoices`

<h3 id="invoicedetailcontroller_getsalesinvoicesglobal-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|days|query|string|true|none|
|customerId|query|string|true|none|
|invoiceId|query|string|true|none|
|limit|query|string|true|none|

<h3 id="invoicedetailcontroller_getsalesinvoicesglobal-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_getPurchaseInvoicesGlobal

<a id="opIdInvoiceDetailController_getPurchaseInvoicesGlobal"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-invoices?days=string&vendorId=string&invoiceId=string&limit=string

```

```http
GET /api/purchase-invoices?days=string&vendorId=string&invoiceId=string&limit=string HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices?days=string&vendorId=string&invoiceId=string&limit=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-invoices',
  params: {
  'days' => 'string',
'vendorId' => 'string',
'invoiceId' => 'string',
'limit' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-invoices', params={
  'days': 'string',  'vendorId': 'string',  'invoiceId': 'string',  'limit': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-invoices', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices?days=string&vendorId=string&invoiceId=string&limit=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-invoices", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-invoices`

<h3 id="invoicedetailcontroller_getpurchaseinvoicesglobal-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|days|query|string|true|none|
|vendorId|query|string|true|none|
|invoiceId|query|string|true|none|
|limit|query|string|true|none|

<h3 id="invoicedetailcontroller_getpurchaseinvoicesglobal-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_createDraftInvoice

<a id="opIdInvoiceDetailController_createDraftInvoice"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-invoices \
  -H 'Accept: application/json'

```

```http
POST /api/purchase-invoices HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-invoices',
{
  method: 'POST',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.post '/api/purchase-invoices',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.post('/api/purchase-invoices', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-invoices', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-invoices", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-invoices`

> Example responses

> 201 Response

```json
{}
```

<h3 id="invoicedetailcontroller_createdraftinvoice-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="invoicedetailcontroller_createdraftinvoice-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_getPurchaseBillDetails

<a id="opIdInvoiceDetailController_getPurchaseBillDetails"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-invoices/{id}

```

```http
GET /api/purchase-invoices/{id} HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-invoices/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-invoices/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-invoices/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-invoices/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-invoices/{id}`

<h3 id="invoicedetailcontroller_getpurchasebilldetails-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="invoicedetailcontroller_getpurchasebilldetails-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_updateInvoice

<a id="opIdInvoiceDetailController_updateInvoice"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/purchase-invoices/{id}

```

```http
PATCH /api/purchase-invoices/{id} HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/{id}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/purchase-invoices/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/purchase-invoices/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/purchase-invoices/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/purchase-invoices/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/purchase-invoices/{id}`

<h3 id="invoicedetailcontroller_updateinvoice-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="invoicedetailcontroller_updateinvoice-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_postInvoice

<a id="opIdInvoiceDetailController_postInvoice"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-invoices/{id}/post \
  -H 'Accept: application/json'

```

```http
POST /api/purchase-invoices/{id}/post HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-invoices/{id}/post',
{
  method: 'POST',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.post '/api/purchase-invoices/{id}/post',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.post('/api/purchase-invoices/{id}/post', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-invoices/{id}/post', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}/post");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-invoices/{id}/post", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-invoices/{id}/post`

<h3 id="invoicedetailcontroller_postinvoice-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="invoicedetailcontroller_postinvoice-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="invoicedetailcontroller_postinvoice-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_changeInvoiceState

<a id="opIdInvoiceDetailController_changeInvoiceState"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/purchase-invoices/{id}/state \
  -H 'Accept: application/json'

```

```http
PATCH /api/purchase-invoices/{id}/state HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-invoices/{id}/state',
{
  method: 'PATCH',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.patch '/api/purchase-invoices/{id}/state',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.patch('/api/purchase-invoices/{id}/state', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/purchase-invoices/{id}/state', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}/state");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/purchase-invoices/{id}/state", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/purchase-invoices/{id}/state`

<h3 id="invoicedetailcontroller_changeinvoicestate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="invoicedetailcontroller_changeinvoicestate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="invoicedetailcontroller_changeinvoicestate-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_updateInvoiceLine

<a id="opIdInvoiceDetailController_updateInvoiceLine"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/purchase-invoices/{id}/lines/{lineId}

```

```http
PATCH /api/purchase-invoices/{id}/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/{id}/lines/{lineId}',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/purchase-invoices/{id}/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/purchase-invoices/{id}/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/purchase-invoices/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/purchase-invoices/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/purchase-invoices/{id}/lines/{lineId}`

<h3 id="invoicedetailcontroller_updateinvoiceline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="invoicedetailcontroller_updateinvoiceline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_removeInvoiceLine

<a id="opIdInvoiceDetailController_removeInvoiceLine"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/purchase-invoices/{id}/lines/{lineId}

```

```http
DELETE /api/purchase-invoices/{id}/lines/{lineId} HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/{id}/lines/{lineId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/purchase-invoices/{id}/lines/{lineId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/purchase-invoices/{id}/lines/{lineId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/purchase-invoices/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/purchase-invoices/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/purchase-invoices/{id}/lines/{lineId}`

<h3 id="invoicedetailcontroller_removeinvoiceline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

<h3 id="invoicedetailcontroller_removeinvoiceline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_addInvoiceLine

<a id="opIdInvoiceDetailController_addInvoiceLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-invoices/{id}/lines

```

```http
POST /api/purchase-invoices/{id}/lines HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/{id}/lines',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-invoices/{id}/lines',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-invoices/{id}/lines')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-invoices/{id}/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}/lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-invoices/{id}/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-invoices/{id}/lines`

<h3 id="invoicedetailcontroller_addinvoiceline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="invoicedetailcontroller_addinvoiceline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_resolveInvoiceLine

<a id="opIdInvoiceDetailController_resolveInvoiceLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-invoices/lines/{lineId}/resolve

```

```http
POST /api/purchase-invoices/lines/{lineId}/resolve HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/lines/{lineId}/resolve',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-invoices/lines/{lineId}/resolve',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-invoices/lines/{lineId}/resolve')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-invoices/lines/{lineId}/resolve', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/lines/{lineId}/resolve");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-invoices/lines/{lineId}/resolve", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-invoices/lines/{lineId}/resolve`

<h3 id="invoicedetailcontroller_resolveinvoiceline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|lineId|path|string|true|none|

<h3 id="invoicedetailcontroller_resolveinvoiceline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_unresolveInvoiceLine

<a id="opIdInvoiceDetailController_unresolveInvoiceLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-invoices/lines/{lineId}/unresolve

```

```http
POST /api/purchase-invoices/lines/{lineId}/unresolve HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/lines/{lineId}/unresolve',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-invoices/lines/{lineId}/unresolve',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-invoices/lines/{lineId}/unresolve')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-invoices/lines/{lineId}/unresolve', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/lines/{lineId}/unresolve");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-invoices/lines/{lineId}/unresolve", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-invoices/lines/{lineId}/unresolve`

<h3 id="invoicedetailcontroller_unresolveinvoiceline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|lineId|path|string|true|none|

<h3 id="invoicedetailcontroller_unresolveinvoiceline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## InvoiceDetailController_autoMatchPurchaseOrder

<a id="opIdInvoiceDetailController_autoMatchPurchaseOrder"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-invoices/{id}/auto-match

```

```http
POST /api/purchase-invoices/{id}/auto-match HTTP/1.1

```

```javascript

fetch('/api/purchase-invoices/{id}/auto-match',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-invoices/{id}/auto-match',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-invoices/{id}/auto-match')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-invoices/{id}/auto-match', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-invoices/{id}/auto-match");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-invoices/{id}/auto-match", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-invoices/{id}/auto-match`

<h3 id="invoicedetailcontroller_automatchpurchaseorder-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="invoicedetailcontroller_automatchpurchaseorder-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-externalsync">ExternalSync</h1>

## ExternalSyncController_getSyncStatus

<a id="opIdExternalSyncController_getSyncStatus"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/external-sync?limit=string

```

```http
GET /api/settings/external-sync?limit=string HTTP/1.1

```

```javascript

fetch('/api/settings/external-sync?limit=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/external-sync',
  params: {
  'limit' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/external-sync', params={
  'limit': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/external-sync', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/external-sync?limit=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/external-sync", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/external-sync`

<h3 id="externalsynccontroller_getsyncstatus-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|limit|query|string|true|none|

<h3 id="externalsynccontroller_getsyncstatus-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ExternalSyncController_getEventsByType

<a id="opIdExternalSyncController_getEventsByType"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/settings/external-sync/events?type=string&status=string&limit=string

```

```http
GET /api/settings/external-sync/events?type=string&status=string&limit=string HTTP/1.1

```

```javascript

fetch('/api/settings/external-sync/events?type=string&status=string&limit=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/settings/external-sync/events',
  params: {
  'type' => 'string',
'status' => 'string',
'limit' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/settings/external-sync/events', params={
  'type': 'string',  'status': 'string',  'limit': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/settings/external-sync/events', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/external-sync/events?type=string&status=string&limit=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/settings/external-sync/events", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/settings/external-sync/events`

<h3 id="externalsynccontroller_geteventsbytype-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|type|query|string|true|none|
|status|query|string|true|none|
|limit|query|string|true|none|

<h3 id="externalsynccontroller_geteventsbytype-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ExternalSyncController_clearEventsByType

<a id="opIdExternalSyncController_clearEventsByType"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/settings/external-sync/events?type=string&status=string

```

```http
DELETE /api/settings/external-sync/events?type=string&status=string HTTP/1.1

```

```javascript

fetch('/api/settings/external-sync/events?type=string&status=string',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/settings/external-sync/events',
  params: {
  'type' => 'string',
'status' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/settings/external-sync/events', params={
  'type': 'string',  'status': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/settings/external-sync/events', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/settings/external-sync/events?type=string&status=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/settings/external-sync/events", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/settings/external-sync/events`

<h3 id="externalsynccontroller_cleareventsbytype-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|type|query|string|true|none|
|status|query|string|true|none|

<h3 id="externalsynccontroller_cleareventsbytype-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-payments">Payments</h1>

## PaymentsController_findAll

<a id="opIdPaymentsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/payments?days=string&allocation=string

```

```http
GET /api/payments?days=string&allocation=string HTTP/1.1

```

```javascript

fetch('/api/payments?days=string&allocation=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/payments',
  params: {
  'days' => 'string',
'allocation' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/payments', params={
  'days': 'string',  'allocation': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/payments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments?days=string&allocation=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/payments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/payments`

<h3 id="paymentscontroller_findall-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|days|query|string|true|none|
|allocation|query|string|true|none|

<h3 id="paymentscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_create

<a id="opIdPaymentsController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/payments \
  -H 'Content-Type: application/json'

```

```http
POST /api/payments HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "paymentType": {},
  "partyType": {},
  "partyId": "950a3d1f-4657-4e7b-87db-3ff5fa95b5c0",
  "paymentDate": "string",
  "modeOfPayment": {},
  "totalAmount": 0.01,
  "glAccountBank": "3e17db10-cc97-4597-bae0-c76c1a013e5b",
  "referenceNumber": "string",
  "currencyCode": "string",
  "submitImmediately": true
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/payments',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/payments',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/payments', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/payments', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/payments", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/payments`

> Body parameter

```json
{
  "paymentType": {},
  "partyType": {},
  "partyId": "950a3d1f-4657-4e7b-87db-3ff5fa95b5c0",
  "paymentDate": "string",
  "modeOfPayment": {},
  "totalAmount": 0.01,
  "glAccountBank": "3e17db10-cc97-4597-bae0-c76c1a013e5b",
  "referenceNumber": "string",
  "currencyCode": "string",
  "submitImmediately": true
}
```

<h3 id="paymentscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreatePaymentDto](#schemacreatepaymentdto)|true|none|

<h3 id="paymentscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_findOne

<a id="opIdPaymentsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/payments/{id}

```

```http
GET /api/payments/{id} HTTP/1.1

```

```javascript

fetch('/api/payments/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/payments/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/payments/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/payments/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/payments/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/payments/{id}`

<h3 id="paymentscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="paymentscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_submit

<a id="opIdPaymentsController_submit"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/payments/{id}/submit

```

```http
PATCH /api/payments/{id}/submit HTTP/1.1

```

```javascript

fetch('/api/payments/{id}/submit',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/payments/{id}/submit',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/payments/{id}/submit')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/payments/{id}/submit', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/{id}/submit");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/payments/{id}/submit", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/payments/{id}/submit`

<h3 id="paymentscontroller_submit-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="paymentscontroller_submit-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_allocate

<a id="opIdPaymentsController_allocate"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/payments/{id}/allocate \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/payments/{id}/allocate HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "allocations": [
    {
      "referenceType": {},
      "referenceId": "8502eb05-558d-4480-8511-c1011710b340",
      "allocatedAmount": 0.01
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/payments/{id}/allocate',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/payments/{id}/allocate',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/payments/{id}/allocate', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/payments/{id}/allocate', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/{id}/allocate");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/payments/{id}/allocate", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/payments/{id}/allocate`

> Body parameter

```json
{
  "allocations": [
    {
      "referenceType": {},
      "referenceId": "8502eb05-558d-4480-8511-c1011710b340",
      "allocatedAmount": 0.01
    }
  ]
}
```

<h3 id="paymentscontroller_allocate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[AllocatePaymentDto](#schemaallocatepaymentdto)|true|none|

<h3 id="paymentscontroller_allocate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_cancel

<a id="opIdPaymentsController_cancel"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/payments/{id}/cancel

```

```http
PATCH /api/payments/{id}/cancel HTTP/1.1

```

```javascript

fetch('/api/payments/{id}/cancel',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/payments/{id}/cancel',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/payments/{id}/cancel')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/payments/{id}/cancel', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/{id}/cancel");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/payments/{id}/cancel", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/payments/{id}/cancel`

<h3 id="paymentscontroller_cancel-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="paymentscontroller_cancel-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_exportAba

<a id="opIdPaymentsController_exportAba"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/payments/export-aba \
  -H 'Content-Type: application/json'

```

```http
POST /api/payments/export-aba HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "paymentIds": [
    "string"
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/payments/export-aba',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/payments/export-aba',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/payments/export-aba', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/payments/export-aba', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/export-aba");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/payments/export-aba", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/payments/export-aba`

> Body parameter

```json
{
  "paymentIds": [
    "string"
  ]
}
```

<h3 id="paymentscontroller_exportaba-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[BatchPaymentActionDto](#schemabatchpaymentactiondto)|true|none|

<h3 id="paymentscontroller_exportaba-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_confirmExported

<a id="opIdPaymentsController_confirmExported"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/payments/confirm-exported \
  -H 'Content-Type: application/json'

```

```http
POST /api/payments/confirm-exported HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "paymentIds": [
    "string"
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/payments/confirm-exported',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/payments/confirm-exported',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/payments/confirm-exported', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/payments/confirm-exported', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/confirm-exported");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/payments/confirm-exported", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/payments/confirm-exported`

> Body parameter

```json
{
  "paymentIds": [
    "string"
  ]
}
```

<h3 id="paymentscontroller_confirmexported-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[BatchPaymentActionDto](#schemabatchpaymentactiondto)|true|none|

<h3 id="paymentscontroller_confirmexported-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PaymentsController_rejectExported

<a id="opIdPaymentsController_rejectExported"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/payments/reject-exported \
  -H 'Content-Type: application/json'

```

```http
POST /api/payments/reject-exported HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "paymentIds": [
    "string"
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/payments/reject-exported',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/payments/reject-exported',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/payments/reject-exported', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/payments/reject-exported', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/payments/reject-exported");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/payments/reject-exported", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/payments/reject-exported`

> Body parameter

```json
{
  "paymentIds": [
    "string"
  ]
}
```

<h3 id="paymentscontroller_rejectexported-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[BatchPaymentActionDto](#schemabatchpaymentactiondto)|true|none|

<h3 id="paymentscontroller_rejectexported-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-dashboard">Dashboard</h1>

## DashboardController_getSummary

<a id="opIdDashboardController_getSummary"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/dashboard/summary

```

```http
GET /api/dashboard/summary HTTP/1.1

```

```javascript

fetch('/api/dashboard/summary',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/dashboard/summary',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/dashboard/summary')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/dashboard/summary', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/dashboard/summary");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/dashboard/summary", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/dashboard/summary`

<h3 id="dashboardcontroller_getsummary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## DashboardController_search

<a id="opIdDashboardController_search"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/dashboard/search?q=string

```

```http
GET /api/dashboard/search?q=string HTTP/1.1

```

```javascript

fetch('/api/dashboard/search?q=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/dashboard/search',
  params: {
  'q' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/dashboard/search', params={
  'q': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/dashboard/search', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/dashboard/search?q=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/dashboard/search", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/dashboard/search`

<h3 id="dashboardcontroller_search-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|q|query|string|true|none|

<h3 id="dashboardcontroller_search-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## DashboardController_getTimeline

<a id="opIdDashboardController_getTimeline"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/dashboard/timeline?types=string&limit=string

```

```http
GET /api/dashboard/timeline?types=string&limit=string HTTP/1.1

```

```javascript

fetch('/api/dashboard/timeline?types=string&limit=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/dashboard/timeline',
  params: {
  'types' => 'string',
'limit' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/dashboard/timeline', params={
  'types': 'string',  'limit': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/dashboard/timeline', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/dashboard/timeline?types=string&limit=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/dashboard/timeline", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/dashboard/timeline`

<h3 id="dashboardcontroller_gettimeline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|types|query|string|true|none|
|limit|query|string|true|none|

<h3 id="dashboardcontroller_gettimeline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-telemetry">Telemetry</h1>

## TelemetryController_reportClientError

<a id="opIdTelemetryController_reportClientError"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/telemetry/client-errors \
  -H 'Content-Type: application/json'

```

```http
POST /api/telemetry/client-errors HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "message": "string",
  "stack": "string",
  "component": "string",
  "url": "http://example.com"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/telemetry/client-errors',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/telemetry/client-errors',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/telemetry/client-errors', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/telemetry/client-errors', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/telemetry/client-errors");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/telemetry/client-errors", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/telemetry/client-errors`

> Body parameter

```json
{
  "message": "string",
  "stack": "string",
  "component": "string",
  "url": "http://example.com"
}
```

<h3 id="telemetrycontroller_reportclienterror-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[ClientErrorDto](#schemaclienterrordto)|true|none|

<h3 id="telemetrycontroller_reportclienterror-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-suppliers">Suppliers</h1>

## SuppliersController_findAll

<a id="opIdSuppliersController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/suppliers

```

```http
GET /api/suppliers HTTP/1.1

```

```javascript

fetch('/api/suppliers',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/suppliers',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/suppliers')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/suppliers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/suppliers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/suppliers`

<h3 id="supplierscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_create

<a id="opIdSuppliersController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/suppliers \
  -H 'Content-Type: application/json'

```

```http
POST /api/suppliers HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "vendorNumber": "string",
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "supplierGroupId": "d5da6b63-b552-4b08-8172-bee7d785a20a",
  "currencyCode": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/suppliers',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/suppliers',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/suppliers', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/suppliers', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/suppliers", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/suppliers`

> Body parameter

```json
{
  "vendorNumber": "string",
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "supplierGroupId": "d5da6b63-b552-4b08-8172-bee7d785a20a",
  "currencyCode": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}
```

<h3 id="supplierscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateSupplierDto](#schemacreatesupplierdto)|true|none|

<h3 id="supplierscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_findByProduct

<a id="opIdSuppliersController_findByProduct"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/suppliers/by-product/{productId}

```

```http
GET /api/suppliers/by-product/{productId} HTTP/1.1

```

```javascript

fetch('/api/suppliers/by-product/{productId}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/suppliers/by-product/{productId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/suppliers/by-product/{productId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/suppliers/by-product/{productId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/by-product/{productId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/suppliers/by-product/{productId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/suppliers/by-product/{productId}`

<h3 id="supplierscontroller_findbyproduct-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productId|path|string|true|none|

<h3 id="supplierscontroller_findbyproduct-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_findOne

<a id="opIdSuppliersController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/suppliers/{id}

```

```http
GET /api/suppliers/{id} HTTP/1.1

```

```javascript

fetch('/api/suppliers/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/suppliers/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/suppliers/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/suppliers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/suppliers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/suppliers/{id}`

<h3 id="supplierscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="supplierscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_update

<a id="opIdSuppliersController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/suppliers/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/suppliers/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "supplierGroupId": "d5da6b63-b552-4b08-8172-bee7d785a20a",
  "currencyCode": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string",
  "stateCode": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/suppliers/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/suppliers/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/suppliers/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/suppliers/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/suppliers/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/suppliers/{id}`

> Body parameter

```json
{
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "supplierGroupId": "d5da6b63-b552-4b08-8172-bee7d785a20a",
  "currencyCode": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string",
  "stateCode": "string"
}
```

<h3 id="supplierscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateSupplierDto](#schemaupdatesupplierdto)|true|none|

<h3 id="supplierscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_findSupplierProducts

<a id="opIdSuppliersController_findSupplierProducts"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/suppliers/{id}/products

```

```http
GET /api/suppliers/{id}/products HTTP/1.1

```

```javascript

fetch('/api/suppliers/{id}/products',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/suppliers/{id}/products',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/suppliers/{id}/products')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/suppliers/{id}/products', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/products");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/suppliers/{id}/products", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/suppliers/{id}/products`

<h3 id="supplierscontroller_findsupplierproducts-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="supplierscontroller_findsupplierproducts-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_archive

<a id="opIdSuppliersController_archive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/suppliers/{id}/archive

```

```http
POST /api/suppliers/{id}/archive HTTP/1.1

```

```javascript

fetch('/api/suppliers/{id}/archive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/suppliers/{id}/archive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/suppliers/{id}/archive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/suppliers/{id}/archive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/archive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/suppliers/{id}/archive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/suppliers/{id}/archive`

<h3 id="supplierscontroller_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="supplierscontroller_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_unarchive

<a id="opIdSuppliersController_unarchive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/suppliers/{id}/unarchive

```

```http
POST /api/suppliers/{id}/unarchive HTTP/1.1

```

```javascript

fetch('/api/suppliers/{id}/unarchive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/suppliers/{id}/unarchive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/suppliers/{id}/unarchive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/suppliers/{id}/unarchive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/unarchive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/suppliers/{id}/unarchive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/suppliers/{id}/unarchive`

<h3 id="supplierscontroller_unarchive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="supplierscontroller_unarchive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_findSupplierExpiries

<a id="opIdSuppliersController_findSupplierExpiries"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/suppliers/{id}/expiries

```

```http
GET /api/suppliers/{id}/expiries HTTP/1.1

```

```javascript

fetch('/api/suppliers/{id}/expiries',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/suppliers/{id}/expiries',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/suppliers/{id}/expiries')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/suppliers/{id}/expiries', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/expiries");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/suppliers/{id}/expiries", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/suppliers/{id}/expiries`

<h3 id="supplierscontroller_findsupplierexpiries-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="supplierscontroller_findsupplierexpiries-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_createExpiry

<a id="opIdSuppliersController_createExpiry"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/suppliers/{id}/expiries \
  -H 'Content-Type: application/json'

```

```http
POST /api/suppliers/{id}/expiries HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "expiryType": "insurance",
  "expiryDate": "string",
  "notes": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/suppliers/{id}/expiries',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/suppliers/{id}/expiries',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/suppliers/{id}/expiries', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/suppliers/{id}/expiries', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/expiries");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/suppliers/{id}/expiries", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/suppliers/{id}/expiries`

> Body parameter

```json
{
  "expiryType": "insurance",
  "expiryDate": "string",
  "notes": "string"
}
```

<h3 id="supplierscontroller_createexpiry-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreateSupplierExpiryDto](#schemacreatesupplierexpirydto)|true|none|

<h3 id="supplierscontroller_createexpiry-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_updateExpiry

<a id="opIdSuppliersController_updateExpiry"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/suppliers/{id}/expiries/{expiryId} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/suppliers/{id}/expiries/{expiryId} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "expiryType": "insurance",
  "expiryDate": "string",
  "notes": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/suppliers/{id}/expiries/{expiryId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/suppliers/{id}/expiries/{expiryId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/suppliers/{id}/expiries/{expiryId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/suppliers/{id}/expiries/{expiryId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/expiries/{expiryId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/suppliers/{id}/expiries/{expiryId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/suppliers/{id}/expiries/{expiryId}`

> Body parameter

```json
{
  "expiryType": "insurance",
  "expiryDate": "string",
  "notes": "string"
}
```

<h3 id="supplierscontroller_updateexpiry-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|expiryId|path|string|true|none|
|body|body|[UpdateSupplierExpiryDto](#schemaupdatesupplierexpirydto)|true|none|

<h3 id="supplierscontroller_updateexpiry-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SuppliersController_deleteExpiry

<a id="opIdSuppliersController_deleteExpiry"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/suppliers/{id}/expiries/{expiryId}

```

```http
DELETE /api/suppliers/{id}/expiries/{expiryId} HTTP/1.1

```

```javascript

fetch('/api/suppliers/{id}/expiries/{expiryId}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/suppliers/{id}/expiries/{expiryId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/suppliers/{id}/expiries/{expiryId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/suppliers/{id}/expiries/{expiryId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/suppliers/{id}/expiries/{expiryId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/suppliers/{id}/expiries/{expiryId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/suppliers/{id}/expiries/{expiryId}`

<h3 id="supplierscontroller_deleteexpiry-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|expiryId|path|string|true|none|

<h3 id="supplierscontroller_deleteexpiry-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-suppliergroups">SupplierGroups</h1>

## SupplierGroupsController_findAll

<a id="opIdSupplierGroupsController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/supplier-groups

```

```http
GET /api/supplier-groups HTTP/1.1

```

```javascript

fetch('/api/supplier-groups',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/supplier-groups',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/supplier-groups')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/supplier-groups', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/supplier-groups");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/supplier-groups", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/supplier-groups`

<h3 id="suppliergroupscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SupplierGroupsController_create

<a id="opIdSupplierGroupsController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/supplier-groups \
  -H 'Content-Type: application/json'

```

```http
POST /api/supplier-groups HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "groupCode": "string",
  "name": "string",
  "defaultApAccountId": "ab2ee3b9-3d2b-4859-bc6d-150439fa711c",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/supplier-groups',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/supplier-groups',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/supplier-groups', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/supplier-groups', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/supplier-groups");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/supplier-groups", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/supplier-groups`

> Body parameter

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultApAccountId": "ab2ee3b9-3d2b-4859-bc6d-150439fa711c",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}
```

<h3 id="suppliergroupscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateSupplierGroupDto](#schemacreatesuppliergroupdto)|true|none|

<h3 id="suppliergroupscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SupplierGroupsController_findOne

<a id="opIdSupplierGroupsController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/supplier-groups/{id}

```

```http
GET /api/supplier-groups/{id} HTTP/1.1

```

```javascript

fetch('/api/supplier-groups/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/supplier-groups/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/supplier-groups/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/supplier-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/supplier-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/supplier-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/supplier-groups/{id}`

<h3 id="suppliergroupscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="suppliergroupscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SupplierGroupsController_update

<a id="opIdSupplierGroupsController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/supplier-groups/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/supplier-groups/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "groupCode": "string",
  "name": "string",
  "defaultApAccountId": "ab2ee3b9-3d2b-4859-bc6d-150439fa711c",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/supplier-groups/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/supplier-groups/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/supplier-groups/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/supplier-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/supplier-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/supplier-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/supplier-groups/{id}`

> Body parameter

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultApAccountId": "ab2ee3b9-3d2b-4859-bc6d-150439fa711c",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}
```

<h3 id="suppliergroupscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateSupplierGroupDto](#schemaupdatesuppliergroupdto)|true|none|

<h3 id="suppliergroupscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SupplierGroupsController_remove

<a id="opIdSupplierGroupsController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/supplier-groups/{id}

```

```http
DELETE /api/supplier-groups/{id} HTTP/1.1

```

```javascript

fetch('/api/supplier-groups/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/supplier-groups/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/supplier-groups/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/supplier-groups/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/supplier-groups/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/supplier-groups/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/supplier-groups/{id}`

<h3 id="suppliergroupscontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="suppliergroupscontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-purchaseorders">PurchaseOrders</h1>

## PurchaseOrdersController_create

<a id="opIdPurchaseOrdersController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/purchase-orders HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "orderNumber": "string",
  "deliveryLocationId": "string",
  "name": "string",
  "vendorId": "string",
  "currencyCode": "string",
  "notes": "string",
  "referenceNumber": "string",
  "lines": [
    {
      "productId": "string",
      "productDescription": "string",
      "quantity": "string",
      "pricePerUnit": "string",
      "discountPercentage": "string",
      "unitOfMeasure": "string",
      "taxCategoryId": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/purchase-orders',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/purchase-orders',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/purchase-orders', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders`

> Body parameter

```json
{
  "orderNumber": "string",
  "deliveryLocationId": "string",
  "name": "string",
  "vendorId": "string",
  "currencyCode": "string",
  "notes": "string",
  "referenceNumber": "string",
  "lines": [
    {
      "productId": "string",
      "productDescription": "string",
      "quantity": "string",
      "pricePerUnit": "string",
      "discountPercentage": "string",
      "unitOfMeasure": "string",
      "taxCategoryId": "string"
    }
  ]
}
```

<h3 id="purchaseorderscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreatePurchaseOrderDto](#schemacreatepurchaseorderdto)|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="purchaseorderscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="purchaseorderscontroller_create-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_findAll

<a id="opIdPurchaseOrdersController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders

```

```http
GET /api/purchase-orders HTTP/1.1

```

```javascript

fetch('/api/purchase-orders',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-orders',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-orders')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders`

<h3 id="purchaseorderscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_findPendingLines

<a id="opIdPurchaseOrdersController_findPendingLines"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders/pending-lines?productId=string&vendorId=string

```

```http
GET /api/purchase-orders/pending-lines?productId=string&vendorId=string HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/pending-lines?productId=string&vendorId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-orders/pending-lines',
  params: {
  'productId' => 'string',
'vendorId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-orders/pending-lines', params={
  'productId': 'string',  'vendorId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders/pending-lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/pending-lines?productId=string&vendorId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders/pending-lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders/pending-lines`

<h3 id="purchaseorderscontroller_findpendinglines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productId|query|string|true|none|
|vendorId|query|string|true|none|

<h3 id="purchaseorderscontroller_findpendinglines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_findReturnableLines

<a id="opIdPurchaseOrdersController_findReturnableLines"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders/returnable-lines?productId=string

```

```http
GET /api/purchase-orders/returnable-lines?productId=string HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/returnable-lines?productId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-orders/returnable-lines',
  params: {
  'productId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-orders/returnable-lines', params={
  'productId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders/returnable-lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/returnable-lines?productId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders/returnable-lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders/returnable-lines`

<h3 id="purchaseorderscontroller_findreturnablelines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|productId|query|string|true|none|

<h3 id="purchaseorderscontroller_findreturnablelines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_findOne

<a id="opIdPurchaseOrdersController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders/{id} \
  -H 'Accept: application/json'

```

```http
GET /api/purchase-orders/{id} HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/purchase-orders/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/purchase-orders/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders/{id}`

<h3 id="purchaseorderscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="purchaseorderscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="purchaseorderscontroller_findone-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_update

<a id="opIdPurchaseOrdersController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/purchase-orders/{id} \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
PATCH /api/purchase-orders/{id} HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "vendorId": "string",
  "currencyCode": "string",
  "notes": "string",
  "referenceNumber": "string",
  "stateCode": "string",
  "deliveryLocationId": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.patch '/api/purchase-orders/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.patch('/api/purchase-orders/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/purchase-orders/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/purchase-orders/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/purchase-orders/{id}`

> Body parameter

```json
{
  "name": "string",
  "vendorId": "string",
  "currencyCode": "string",
  "notes": "string",
  "referenceNumber": "string",
  "stateCode": "string",
  "deliveryLocationId": "string"
}
```

<h3 id="purchaseorderscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdatePurchaseOrderDto](#schemaupdatepurchaseorderdto)|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="purchaseorderscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="purchaseorderscontroller_update-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_changeState

<a id="opIdPurchaseOrdersController_changeState"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/purchase-orders/{id}/state

```

```http
PATCH /api/purchase-orders/{id}/state HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/{id}/state',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/purchase-orders/{id}/state',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/purchase-orders/{id}/state')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/purchase-orders/{id}/state', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/state");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/purchase-orders/{id}/state", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/purchase-orders/{id}/state`

<h3 id="purchaseorderscontroller_changestate-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="purchaseorderscontroller_changestate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_archive

<a id="opIdPurchaseOrdersController_archive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders/{id}/archive

```

```http
POST /api/purchase-orders/{id}/archive HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/{id}/archive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-orders/{id}/archive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-orders/{id}/archive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders/{id}/archive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/archive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders/{id}/archive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders/{id}/archive`

<h3 id="purchaseorderscontroller_archive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="purchaseorderscontroller_archive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_unarchive

<a id="opIdPurchaseOrdersController_unarchive"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders/{id}/unarchive

```

```http
POST /api/purchase-orders/{id}/unarchive HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/{id}/unarchive',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-orders/{id}/unarchive',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-orders/{id}/unarchive')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders/{id}/unarchive', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/unarchive");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders/{id}/unarchive", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders/{id}/unarchive`

<h3 id="purchaseorderscontroller_unarchive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="purchaseorderscontroller_unarchive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_addLine

<a id="opIdPurchaseOrdersController_addLine"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders/{id}/lines \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/purchase-orders/{id}/lines HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "unitOfMeasure": "string",
  "taxCategoryId": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}/lines',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/purchase-orders/{id}/lines',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/purchase-orders/{id}/lines', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders/{id}/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/lines");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders/{id}/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders/{id}/lines`

> Body parameter

```json
{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "unitOfMeasure": "string",
  "taxCategoryId": "string"
}
```

<h3 id="purchaseorderscontroller_addline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreatePurchaseOrderLineDto](#schemacreatepurchaseorderlinedto)|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="purchaseorderscontroller_addline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="purchaseorderscontroller_addline-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_updateLine

<a id="opIdPurchaseOrdersController_updateLine"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/purchase-orders/{id}/lines/{lineId} \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
PATCH /api/purchase-orders/{id}/lines/{lineId} HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "productDescription": "string",
  "unitOfMeasure": "string",
  "taxCategoryId": "string"
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}/lines/{lineId}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.patch '/api/purchase-orders/{id}/lines/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.patch('/api/purchase-orders/{id}/lines/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/purchase-orders/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/purchase-orders/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/purchase-orders/{id}/lines/{lineId}`

> Body parameter

```json
{
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "productDescription": "string",
  "unitOfMeasure": "string",
  "taxCategoryId": "string"
}
```

<h3 id="purchaseorderscontroller_updateline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|
|body|body|[UpdatePurchaseOrderLineDto](#schemaupdatepurchaseorderlinedto)|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="purchaseorderscontroller_updateline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="purchaseorderscontroller_updateline-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseOrdersController_removeLine

<a id="opIdPurchaseOrdersController_removeLine"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/purchase-orders/{id}/lines/{lineId} \
  -H 'Accept: application/json'

```

```http
DELETE /api/purchase-orders/{id}/lines/{lineId} HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}/lines/{lineId}',
{
  method: 'DELETE',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.delete '/api/purchase-orders/{id}/lines/{lineId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.delete('/api/purchase-orders/{id}/lines/{lineId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/purchase-orders/{id}/lines/{lineId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/lines/{lineId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/purchase-orders/{id}/lines/{lineId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/purchase-orders/{id}/lines/{lineId}`

<h3 id="purchaseorderscontroller_removeline-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|lineId|path|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="purchaseorderscontroller_removeline-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="purchaseorderscontroller_removeline-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-purchasereturns">PurchaseReturns</h1>

## PurchaseReturnsController_createReturn

<a id="opIdPurchaseReturnsController_createReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders/{id}/returns \
  -H 'Content-Type: application/json'

```

```http
POST /api/purchase-orders/{id}/returns HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "notes": "string",
  "lines": [
    {
      "purchaseOrderLineId": "string",
      "quantityReturned": "string",
      "reason": "string",
      "returnFee": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/purchase-orders/{id}/returns',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/purchase-orders/{id}/returns',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/purchase-orders/{id}/returns', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders/{id}/returns', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/returns");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders/{id}/returns", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders/{id}/returns`

> Body parameter

```json
{
  "notes": "string",
  "lines": [
    {
      "purchaseOrderLineId": "string",
      "quantityReturned": "string",
      "reason": "string",
      "returnFee": "string"
    }
  ]
}
```

<h3 id="purchasereturnscontroller_createreturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[CreatePurchaseReturnDto](#schemacreatepurchasereturndto)|true|none|

<h3 id="purchasereturnscontroller_createreturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseReturnsController_findReturns

<a id="opIdPurchaseReturnsController_findReturns"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders/{id}/returns

```

```http
GET /api/purchase-orders/{id}/returns HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/{id}/returns',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-orders/{id}/returns',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-orders/{id}/returns')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders/{id}/returns', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/returns");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders/{id}/returns", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders/{id}/returns`

<h3 id="purchasereturnscontroller_findreturns-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="purchasereturnscontroller_findreturns-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseReturnsController_findReturn

<a id="opIdPurchaseReturnsController_findReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-orders/{id}/returns/{returnId}

```

```http
GET /api/purchase-orders/{id}/returns/{returnId} HTTP/1.1

```

```javascript

fetch('/api/purchase-orders/{id}/returns/{returnId}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-orders/{id}/returns/{returnId}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-orders/{id}/returns/{returnId}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-orders/{id}/returns/{returnId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/returns/{returnId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-orders/{id}/returns/{returnId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-orders/{id}/returns/{returnId}`

<h3 id="purchasereturnscontroller_findreturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|

<h3 id="purchasereturnscontroller_findreturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseReturnsController_stageReturn

<a id="opIdPurchaseReturnsController_stageReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders/{id}/returns/{returnId}/stage \
  -H 'Accept: application/json'

```

```http
POST /api/purchase-orders/{id}/returns/{returnId}/stage HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}/returns/{returnId}/stage',
{
  method: 'POST',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.post '/api/purchase-orders/{id}/returns/{returnId}/stage',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.post('/api/purchase-orders/{id}/returns/{returnId}/stage', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders/{id}/returns/{returnId}/stage', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/returns/{returnId}/stage");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders/{id}/returns/{returnId}/stage", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders/{id}/returns/{returnId}/stage`

<h3 id="purchasereturnscontroller_stagereturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="purchasereturnscontroller_stagereturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="purchasereturnscontroller_stagereturn-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseReturnsController_shipReturn

<a id="opIdPurchaseReturnsController_shipReturn"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-orders/{id}/returns/{returnId}/ship \
  -H 'Accept: application/json'

```

```http
POST /api/purchase-orders/{id}/returns/{returnId}/ship HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/purchase-orders/{id}/returns/{returnId}/ship',
{
  method: 'POST',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.post '/api/purchase-orders/{id}/returns/{returnId}/ship',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.post('/api/purchase-orders/{id}/returns/{returnId}/ship', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-orders/{id}/returns/{returnId}/ship', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-orders/{id}/returns/{returnId}/ship");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-orders/{id}/returns/{returnId}/ship", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-orders/{id}/returns/{returnId}/ship`

<h3 id="purchasereturnscontroller_shipreturn-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|returnId|path|string|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="purchasereturnscontroller_shipreturn-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="purchasereturnscontroller_shipreturn-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-globalpurchasereturns">GlobalPurchaseReturns</h1>

## GlobalPurchaseReturnsController_getPurchaseReturns

<a id="opIdGlobalPurchaseReturnsController_getPurchaseReturns"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-returns?stateCode=string

```

```http
GET /api/purchase-returns?stateCode=string HTTP/1.1

```

```javascript

fetch('/api/purchase-returns?stateCode=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-returns',
  params: {
  'stateCode' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-returns', params={
  'stateCode': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-returns', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-returns?stateCode=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-returns", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-returns`

<h3 id="globalpurchasereturnscontroller_getpurchasereturns-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|stateCode|query|string|true|none|

<h3 id="globalpurchasereturnscontroller_getpurchasereturns-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GlobalPurchaseReturnsController_getPurchaseReturnById

<a id="opIdGlobalPurchaseReturnsController_getPurchaseReturnById"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/purchase-returns/{id}

```

```http
GET /api/purchase-returns/{id} HTTP/1.1

```

```javascript

fetch('/api/purchase-returns/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/purchase-returns/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/purchase-returns/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/purchase-returns/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-returns/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/purchase-returns/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/purchase-returns/{id}`

<h3 id="globalpurchasereturnscontroller_getpurchasereturnbyid-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="globalpurchasereturnscontroller_getpurchasereturnbyid-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-purchasedebitnotes">PurchaseDebitNotes</h1>

## PurchaseDebitNotesController_createDebitNote

<a id="opIdPurchaseDebitNotesController_createDebitNote"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-debit-notes \
  -H 'Content-Type: application/json'

```

```http
POST /api/purchase-debit-notes HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "returnId": "string",
  "supplierReferenceNumber": "string",
  "lines": [
    {
      "purchaseOrderLineId": "string",
      "quantityInvoiced": "string",
      "pricePerUnit": "string",
      "amount": "string",
      "taxAmount": "string"
    }
  ],
  "taxAmount": "string",
  "feeAmount": "string",
  "notes": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/purchase-debit-notes',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/purchase-debit-notes',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/purchase-debit-notes', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-debit-notes', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-debit-notes");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-debit-notes", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-debit-notes`

> Body parameter

```json
{
  "returnId": "string",
  "supplierReferenceNumber": "string",
  "lines": [
    {
      "purchaseOrderLineId": "string",
      "quantityInvoiced": "string",
      "pricePerUnit": "string",
      "amount": "string",
      "taxAmount": "string"
    }
  ],
  "taxAmount": "string",
  "feeAmount": "string",
  "notes": "string"
}
```

<h3 id="purchasedebitnotescontroller_createdebitnote-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateDebitNoteDto](#schemacreatedebitnotedto)|true|none|

<h3 id="purchasedebitnotescontroller_createdebitnote-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## PurchaseDebitNotesController_postDebitNote

<a id="opIdPurchaseDebitNotesController_postDebitNote"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/purchase-debit-notes/{id}/post

```

```http
POST /api/purchase-debit-notes/{id}/post HTTP/1.1

```

```javascript

fetch('/api/purchase-debit-notes/{id}/post',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/purchase-debit-notes/{id}/post',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/purchase-debit-notes/{id}/post')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/purchase-debit-notes/{id}/post', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/purchase-debit-notes/{id}/post");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/purchase-debit-notes/{id}/post", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/purchase-debit-notes/{id}/post`

<h3 id="purchasedebitnotescontroller_postdebitnote-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="purchasedebitnotescontroller_postdebitnote-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-system">System</h1>

## SystemController_getSystemLogs

<a id="opIdSystemController_getSystemLogs"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/admin/system-logs?service=string&lines=string

```

```http
GET /api/admin/system-logs?service=string&lines=string HTTP/1.1

```

```javascript

fetch('/api/admin/system-logs?service=string&lines=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/admin/system-logs',
  params: {
  'service' => 'string',
'lines' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/admin/system-logs', params={
  'service': 'string',  'lines': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/admin/system-logs', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/admin/system-logs?service=string&lines=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/admin/system-logs", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/admin/system-logs`

<h3 id="systemcontroller_getsystemlogs-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|service|query|string|true|none|
|lines|query|string|true|none|

<h3 id="systemcontroller_getsystemlogs-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-setup">Setup</h1>

## SetupController_testAbm

<a id="opIdSetupController_testAbm"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/setup/test-abm \
  -H 'Content-Type: application/json'

```

```http
POST /api/setup/test-abm HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "host": "string",
  "database": "string",
  "username": "string",
  "password": "string",
  "port": 1
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/setup/test-abm',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/setup/test-abm',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/setup/test-abm', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/setup/test-abm', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/test-abm");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/setup/test-abm", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/setup/test-abm`

> Body parameter

```json
{
  "host": "string",
  "database": "string",
  "username": "string",
  "password": "string",
  "port": 1
}
```

<h3 id="setupcontroller_testabm-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[TestAbmConnectionDto](#schematestabmconnectiondto)|true|none|

<h3 id="setupcontroller_testabm-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_testOdoo

<a id="opIdSetupController_testOdoo"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/setup/test-odoo \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/setup/test-odoo HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "host": "string",
  "database": "string",
  "username": "string",
  "password": "string",
  "port": 1
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/setup/test-odoo',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/setup/test-odoo',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/setup/test-odoo', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/setup/test-odoo', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/test-odoo");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/setup/test-odoo", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/setup/test-odoo`

> Body parameter

```json
{
  "host": "string",
  "database": "string",
  "username": "string",
  "password": "string",
  "port": 1
}
```

<h3 id="setupcontroller_testodoo-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[TestOdooConnectionDto](#schematestodooconnectiondto)|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="setupcontroller_testodoo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="setupcontroller_testodoo-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_getResumeState

<a id="opIdSetupController_getResumeState"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/setup/resume-state

```

```http
GET /api/setup/resume-state HTTP/1.1

```

```javascript

fetch('/api/setup/resume-state',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/setup/resume-state',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/setup/resume-state')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/setup/resume-state', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/resume-state");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/setup/resume-state", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/setup/resume-state`

<h3 id="setupcontroller_getresumestate-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_getResumeStateOdoo

<a id="opIdSetupController_getResumeStateOdoo"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/setup/resume-state-odoo \
  -H 'Accept: application/json'

```

```http
GET /api/setup/resume-state-odoo HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/setup/resume-state-odoo',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/setup/resume-state-odoo',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/setup/resume-state-odoo', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/setup/resume-state-odoo', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/resume-state-odoo");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/setup/resume-state-odoo", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/setup/resume-state-odoo`

> Example responses

> 200 Response

```json
{}
```

<h3 id="setupcontroller_getresumestateodoo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="setupcontroller_getresumestateodoo-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_executeElt

<a id="opIdSetupController_executeElt"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/setup/execute-elt \
  -H 'Content-Type: application/json'

```

```http
POST /api/setup/execute-elt HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "dbConfig": {
    "host": "string",
    "database": "string",
    "username": "string",
    "password": "string",
    "port": 0
  },
  "abmImport": true,
  "odooImport": true,
  "resumeExtraction": true,
  "skipExtraction": true,
  "defaultLocationCode": "string",
  "baseCurrency": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/setup/execute-elt',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/setup/execute-elt',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/setup/execute-elt', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/setup/execute-elt', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/execute-elt");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/setup/execute-elt", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/setup/execute-elt`

> Body parameter

```json
{
  "dbConfig": {
    "host": "string",
    "database": "string",
    "username": "string",
    "password": "string",
    "port": 0
  },
  "abmImport": true,
  "odooImport": true,
  "resumeExtraction": true,
  "skipExtraction": true,
  "defaultLocationCode": "string",
  "baseCurrency": "string"
}
```

<h3 id="setupcontroller_executeelt-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[ExecuteEltDto](#schemaexecuteeltdto)|true|none|

<h3 id="setupcontroller_executeelt-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_getProgress

<a id="opIdSetupController_getProgress"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/setup/progress/{jobId} \
  -H 'Accept: application/json'

```

```http
GET /api/setup/progress/{jobId} HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/setup/progress/{jobId}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/setup/progress/{jobId}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/setup/progress/{jobId}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/setup/progress/{jobId}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/progress/{jobId}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/setup/progress/{jobId}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/setup/progress/{jobId}`

<h3 id="setupcontroller_getprogress-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|jobId|path|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="setupcontroller_getprogress-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="setupcontroller_getprogress-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_getValidation

<a id="opIdSetupController_getValidation"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/setup/validation \
  -H 'Accept: application/json'

```

```http
GET /api/setup/validation HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/setup/validation',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/setup/validation',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/setup/validation', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/setup/validation', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/validation");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/setup/validation", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/setup/validation`

> Example responses

> 200 Response

```json
{}
```

<h3 id="setupcontroller_getvalidation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="setupcontroller_getvalidation-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_getImportSummary

<a id="opIdSetupController_getImportSummary"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/setup/import-summary

```

```http
GET /api/setup/import-summary HTTP/1.1

```

```javascript

fetch('/api/setup/import-summary',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/setup/import-summary',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/setup/import-summary')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/setup/import-summary', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/import-summary");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/setup/import-summary", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/setup/import-summary`

<h3 id="setupcontroller_getimportsummary-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_getCsvMetadata

<a id="opIdSetupController_getCsvMetadata"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/setup/csv-metadata

```

```http
GET /api/setup/csv-metadata HTTP/1.1

```

```javascript

fetch('/api/setup/csv-metadata',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/setup/csv-metadata',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/setup/csv-metadata')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/setup/csv-metadata', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/csv-metadata");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/setup/csv-metadata", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/setup/csv-metadata`

<h3 id="setupcontroller_getcsvmetadata-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## SetupController_executeCsv

<a id="opIdSetupController_executeCsv"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/setup/execute-csv

```

```http
POST /api/setup/execute-csv HTTP/1.1

```

```javascript

fetch('/api/setup/execute-csv',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/setup/execute-csv',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/setup/execute-csv')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/setup/execute-csv', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/setup/execute-csv");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/setup/execute-csv", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/setup/execute-csv`

<h3 id="setupcontroller_executecsv-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-goodsreceived">GoodsReceived</h1>

## GoodsReceivedController_create

<a id="opIdGoodsReceivedController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/goods-received \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json'

```

```http
POST /api/goods-received HTTP/1.1

Content-Type: application/json
Accept: application/json

```

```javascript
const inputBody = '{
  "vendorId": "string",
  "locationId": "string",
  "packingSlipNumber": "string",
  "notes": "string",
  "lines": [
    {
      "productId": "string",
      "quantityReceived": "string"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/json'
};

fetch('/api/goods-received',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json',
  'Accept' => 'application/json'
}

result = RestClient.post '/api/goods-received',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

r = requests.post('/api/goods-received', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/goods-received', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/goods-received", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/goods-received`

> Body parameter

```json
{
  "vendorId": "string",
  "locationId": "string",
  "packingSlipNumber": "string",
  "notes": "string",
  "lines": [
    {
      "productId": "string",
      "quantityReceived": "string"
    }
  ]
}
```

<h3 id="goodsreceivedcontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateGoodsReceivedDto](#schemacreategoodsreceiveddto)|true|none|

> Example responses

> 201 Response

```json
{}
```

<h3 id="goodsreceivedcontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|Inline|

<h3 id="goodsreceivedcontroller_create-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## GoodsReceivedController_findAll

<a id="opIdGoodsReceivedController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/goods-received

```

```http
GET /api/goods-received HTTP/1.1

```

```javascript

fetch('/api/goods-received',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/goods-received',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/goods-received')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/goods-received', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/goods-received", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/goods-received`

<h3 id="goodsreceivedcontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GoodsReceivedController_findAllLines

<a id="opIdGoodsReceivedController_findAllLines"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/goods-received/lines?purchaseOrderId=string&putawayStatus=string&locationId=string

```

```http
GET /api/goods-received/lines?purchaseOrderId=string&putawayStatus=string&locationId=string HTTP/1.1

```

```javascript

fetch('/api/goods-received/lines?purchaseOrderId=string&putawayStatus=string&locationId=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/goods-received/lines',
  params: {
  'purchaseOrderId' => 'string',
'putawayStatus' => 'string',
'locationId' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/goods-received/lines', params={
  'purchaseOrderId': 'string',  'putawayStatus': 'string',  'locationId': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/goods-received/lines', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received/lines?purchaseOrderId=string&putawayStatus=string&locationId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/goods-received/lines", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/goods-received/lines`

<h3 id="goodsreceivedcontroller_findalllines-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|purchaseOrderId|query|string|true|none|
|putawayStatus|query|string|true|none|
|locationId|query|string|true|none|

<h3 id="goodsreceivedcontroller_findalllines-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GoodsReceivedController_findOne

<a id="opIdGoodsReceivedController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/goods-received/{id} \
  -H 'Accept: application/json'

```

```http
GET /api/goods-received/{id} HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/goods-received/{id}',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/goods-received/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/goods-received/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/goods-received/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/goods-received/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/goods-received/{id}`

<h3 id="goodsreceivedcontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

> Example responses

> 200 Response

```json
{}
```

<h3 id="goodsreceivedcontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="goodsreceivedcontroller_findone-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## GoodsReceivedController_cancelReception

<a id="opIdGoodsReceivedController_cancelReception"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/goods-received/{id}/cancel

```

```http
POST /api/goods-received/{id}/cancel HTTP/1.1

```

```javascript

fetch('/api/goods-received/{id}/cancel',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/goods-received/{id}/cancel',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/goods-received/{id}/cancel')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/goods-received/{id}/cancel', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received/{id}/cancel");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/goods-received/{id}/cancel", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/goods-received/{id}/cancel`

<h3 id="goodsreceivedcontroller_cancelreception-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="goodsreceivedcontroller_cancelreception-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GoodsReceivedController_resolveAllocation

<a id="opIdGoodsReceivedController_resolveAllocation"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/goods-received/lines/{lineId}/resolve \
  -H 'Content-Type: application/json'

```

```http
POST /api/goods-received/lines/{lineId}/resolve HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "purchaseOrderLineId": "string",
  "allocatedQuantity": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/goods-received/lines/{lineId}/resolve',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/goods-received/lines/{lineId}/resolve',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/goods-received/lines/{lineId}/resolve', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/goods-received/lines/{lineId}/resolve', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received/lines/{lineId}/resolve");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/goods-received/lines/{lineId}/resolve", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/goods-received/lines/{lineId}/resolve`

> Body parameter

```json
{
  "purchaseOrderLineId": "string",
  "allocatedQuantity": "string"
}
```

<h3 id="goodsreceivedcontroller_resolveallocation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|lineId|path|string|true|none|
|body|body|[ResolveAllocationDto](#schemaresolveallocationdto)|true|none|

<h3 id="goodsreceivedcontroller_resolveallocation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## GoodsReceivedController_unresolveAllocation

<a id="opIdGoodsReceivedController_unresolveAllocation"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/goods-received/lines/{lineId}/unresolve

```

```http
POST /api/goods-received/lines/{lineId}/unresolve HTTP/1.1

```

```javascript

fetch('/api/goods-received/lines/{lineId}/unresolve',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/goods-received/lines/{lineId}/unresolve',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/goods-received/lines/{lineId}/unresolve')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/goods-received/lines/{lineId}/unresolve', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/goods-received/lines/{lineId}/unresolve");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/goods-received/lines/{lineId}/unresolve", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/goods-received/lines/{lineId}/unresolve`

<h3 id="goodsreceivedcontroller_unresolveallocation-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|lineId|path|string|true|none|

<h3 id="goodsreceivedcontroller_unresolveallocation-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-macros">Macros</h1>

## MacrosController_create

<a id="opIdMacrosController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/macros \
  -H 'Content-Type: application/json'

```

```http
POST /api/macros HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "macroType": "string",
  "content": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/macros',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/macros',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/macros', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/macros', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/macros");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/macros", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/macros`

> Body parameter

```json
{
  "name": "string",
  "macroType": "string",
  "content": "string"
}
```

<h3 id="macroscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateMacroDto](#schemacreatemacrodto)|true|none|

<h3 id="macroscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## MacrosController_findAll

<a id="opIdMacrosController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/macros?macroType=string

```

```http
GET /api/macros?macroType=string HTTP/1.1

```

```javascript

fetch('/api/macros?macroType=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/macros',
  params: {
  'macroType' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/macros', params={
  'macroType': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/macros', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/macros?macroType=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/macros", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/macros`

<h3 id="macroscontroller_findall-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|macroType|query|string|true|none|

<h3 id="macroscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## MacrosController_findOne

<a id="opIdMacrosController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/macros/{id}

```

```http
GET /api/macros/{id} HTTP/1.1

```

```javascript

fetch('/api/macros/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/macros/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/macros/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/macros/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/macros/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/macros/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/macros/{id}`

<h3 id="macroscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="macroscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## MacrosController_update

<a id="opIdMacrosController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/macros/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/macros/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "name": "string",
  "macroType": "string",
  "content": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/macros/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/macros/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/macros/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/macros/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/macros/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/macros/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/macros/{id}`

> Body parameter

```json
{
  "name": "string",
  "macroType": "string",
  "content": "string"
}
```

<h3 id="macroscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateMacroDto](#schemaupdatemacrodto)|true|none|

<h3 id="macroscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## MacrosController_remove

<a id="opIdMacrosController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/macros/{id}

```

```http
DELETE /api/macros/{id} HTTP/1.1

```

```javascript

fetch('/api/macros/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/macros/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/macros/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/macros/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/macros/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/macros/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/macros/{id}`

<h3 id="macroscontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="macroscontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-users">Users</h1>

## UsersController_findAll

<a id="opIdUsersController_findAll"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/users

```

```http
GET /api/users HTTP/1.1

```

```javascript

fetch('/api/users',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/users',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/users')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/users', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/users");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/users", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/users`

<h3 id="userscontroller_findall-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UsersController_create

<a id="opIdUsersController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/users \
  -H 'Content-Type: application/json'

```

```http
POST /api/users HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "username": "string",
  "password": "string",
  "role": "admin",
  "displayName": "string",
  "email": "user@example.com"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/users',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/users',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/users', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/users', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/users");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/users", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/users`

> Body parameter

```json
{
  "username": "string",
  "password": "string",
  "role": "admin",
  "displayName": "string",
  "email": "user@example.com"
}
```

<h3 id="userscontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateUserDto](#schemacreateuserdto)|true|none|

<h3 id="userscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UsersController_findOne

<a id="opIdUsersController_findOne"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/users/{id}

```

```http
GET /api/users/{id} HTTP/1.1

```

```javascript

fetch('/api/users/{id}',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/users/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/users/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/users/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/users/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/users/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/users/{id}`

<h3 id="userscontroller_findone-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="userscontroller_findone-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UsersController_update

<a id="opIdUsersController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/users/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/users/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "password": "string",
  "role": "admin",
  "displayName": "string",
  "email": "user@example.com"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/users/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/users/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/users/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/users/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/users/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/users/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/users/{id}`

> Body parameter

```json
{
  "password": "string",
  "role": "admin",
  "displayName": "string",
  "email": "user@example.com"
}
```

<h3 id="userscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateUserDto](#schemaupdateuserdto)|true|none|

<h3 id="userscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UsersController_remove

<a id="opIdUsersController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/users/{id}

```

```http
DELETE /api/users/{id} HTTP/1.1

```

```javascript

fetch('/api/users/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/users/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/users/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/users/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/users/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/users/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/users/{id}`

<h3 id="userscontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="userscontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## UsersController_toggleActive

<a id="opIdUsersController_toggleActive"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/users/{id}/toggle-active

```

```http
PATCH /api/users/{id}/toggle-active HTTP/1.1

```

```javascript

fetch('/api/users/{id}/toggle-active',
{
  method: 'PATCH'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.patch '/api/users/{id}/toggle-active',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.patch('/api/users/{id}/toggle-active')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/users/{id}/toggle-active', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/users/{id}/toggle-active");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/users/{id}/toggle-active", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/users/{id}/toggle-active`

<h3 id="userscontroller_toggleactive-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="userscontroller_toggleactive-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-discountmatrix">DiscountMatrix</h1>

## DiscountMatrixController_list

<a id="opIdDiscountMatrixController_list"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/discount-matrix?customerGroupId=string&customerId=string&ownerType=string

```

```http
GET /api/discount-matrix?customerGroupId=string&customerId=string&ownerType=string HTTP/1.1

```

```javascript

fetch('/api/discount-matrix?customerGroupId=string&customerId=string&ownerType=string',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/discount-matrix',
  params: {
  'customerGroupId' => 'string',
'customerId' => 'string',
'ownerType' => 'string'
}

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/discount-matrix', params={
  'customerGroupId': 'string',  'customerId': 'string',  'ownerType': 'string'
})

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/discount-matrix', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/discount-matrix?customerGroupId=string&customerId=string&ownerType=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/discount-matrix", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/discount-matrix`

<h3 id="discountmatrixcontroller_list-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|customerGroupId|query|string|true|none|
|customerId|query|string|true|none|
|ownerType|query|string|true|none|

<h3 id="discountmatrixcontroller_list-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## DiscountMatrixController_create

<a id="opIdDiscountMatrixController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/discount-matrix \
  -H 'Content-Type: application/json'

```

```http
POST /api/discount-matrix HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "customerId": "87d8e330-2878-4742-a86f-dbbb3bf522ac",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "discountPercentage": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/discount-matrix',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.post '/api/discount-matrix',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.post('/api/discount-matrix', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/discount-matrix', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/discount-matrix");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/discount-matrix", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/discount-matrix`

> Body parameter

```json
{
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "customerId": "87d8e330-2878-4742-a86f-dbbb3bf522ac",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "discountPercentage": "string"
}
```

<h3 id="discountmatrixcontroller_create-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateDiscountMatrixDto](#schemacreatediscountmatrixdto)|true|none|

<h3 id="discountmatrixcontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## DiscountMatrixController_resolve

<a id="opIdDiscountMatrixController_resolve"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/discount-matrix/resolve?customerId=string&customerGroupId=string \
  -H 'Accept: application/json'

```

```http
GET /api/discount-matrix/resolve?customerId=string&customerGroupId=string HTTP/1.1

Accept: application/json

```

```javascript

const headers = {
  'Accept':'application/json'
};

fetch('/api/discount-matrix/resolve?customerId=string&customerGroupId=string',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Accept' => 'application/json'
}

result = RestClient.get '/api/discount-matrix/resolve',
  params: {
  'customerId' => 'string',
'customerGroupId' => 'string'
}, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('/api/discount-matrix/resolve', params={
  'customerId': 'string',  'customerGroupId': 'string'
}, headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Accept' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/discount-matrix/resolve', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/discount-matrix/resolve?customerId=string&customerGroupId=string");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Accept": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/discount-matrix/resolve", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/discount-matrix/resolve`

<h3 id="discountmatrixcontroller_resolve-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|customerId|query|string|true|none|
|customerGroupId|query|string|true|none|

> Example responses

> 200 Response

```json
[
  {}
]
```

<h3 id="discountmatrixcontroller_resolve-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

<h3 id="discountmatrixcontroller_resolve-responseschema">Response Schema</h3>

<aside class="success">
This operation does not require authentication
</aside>

## DiscountMatrixController_update

<a id="opIdDiscountMatrixController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PATCH /api/discount-matrix/{id} \
  -H 'Content-Type: application/json'

```

```http
PATCH /api/discount-matrix/{id} HTTP/1.1

Content-Type: application/json

```

```javascript
const inputBody = '{
  "discountPercentage": "string"
}';
const headers = {
  'Content-Type':'application/json'
};

fetch('/api/discount-matrix/{id}',
{
  method: 'PATCH',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

headers = {
  'Content-Type' => 'application/json'
}

result = RestClient.patch '/api/discount-matrix/{id}',
  params: {
  }, headers: headers

p JSON.parse(result)

```

```python
import requests
headers = {
  'Content-Type': 'application/json'
}

r = requests.patch('/api/discount-matrix/{id}', headers = headers)

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$headers = array(
    'Content-Type' => 'application/json',
);

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PATCH','/api/discount-matrix/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/discount-matrix/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PATCH");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    headers := map[string][]string{
        "Content-Type": []string{"application/json"},
    }

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PATCH", "/api/discount-matrix/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PATCH /api/discount-matrix/{id}`

> Body parameter

```json
{
  "discountPercentage": "string"
}
```

<h3 id="discountmatrixcontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|
|body|body|[UpdateDiscountMatrixDto](#schemaupdatediscountmatrixdto)|true|none|

<h3 id="discountmatrixcontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## DiscountMatrixController_delete

<a id="opIdDiscountMatrixController_delete"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/discount-matrix/{id}

```

```http
DELETE /api/discount-matrix/{id} HTTP/1.1

```

```javascript

fetch('/api/discount-matrix/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/discount-matrix/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/discount-matrix/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/discount-matrix/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/discount-matrix/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/discount-matrix/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/discount-matrix/{id}`

<h3 id="discountmatrixcontroller_delete-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="discountmatrixcontroller_delete-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-webhooks">Webhooks</h1>

## WebhooksController_list

<a id="opIdWebhooksController_list"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/webhooks

```

```http
GET /api/webhooks HTTP/1.1

```

```javascript

fetch('/api/webhooks',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/webhooks',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/webhooks')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/webhooks', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/webhooks");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/webhooks", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/webhooks`

<h3 id="webhookscontroller_list-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## WebhooksController_create

<a id="opIdWebhooksController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/webhooks

```

```http
POST /api/webhooks HTTP/1.1

```

```javascript

fetch('/api/webhooks',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/webhooks',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/webhooks')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/webhooks', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/webhooks");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/webhooks", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/webhooks`

<h3 id="webhookscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## WebhooksController_update

<a id="opIdWebhooksController_update"></a>

> Code samples

```shell
# You can also use wget
curl -X PUT /api/webhooks/{id}

```

```http
PUT /api/webhooks/{id} HTTP/1.1

```

```javascript

fetch('/api/webhooks/{id}',
{
  method: 'PUT'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.put '/api/webhooks/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.put('/api/webhooks/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('PUT','/api/webhooks/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/webhooks/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("PUT");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("PUT", "/api/webhooks/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`PUT /api/webhooks/{id}`

<h3 id="webhookscontroller_update-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="webhookscontroller_update-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## WebhooksController_remove

<a id="opIdWebhooksController_remove"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/webhooks/{id}

```

```http
DELETE /api/webhooks/{id} HTTP/1.1

```

```javascript

fetch('/api/webhooks/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/webhooks/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/webhooks/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/webhooks/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/webhooks/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/webhooks/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/webhooks/{id}`

<h3 id="webhookscontroller_remove-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="webhookscontroller_remove-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="modbm-api-apikeys">ApiKeys</h1>

## ApiKeysController_list

<a id="opIdApiKeysController_list"></a>

> Code samples

```shell
# You can also use wget
curl -X GET /api/api-keys

```

```http
GET /api/api-keys HTTP/1.1

```

```javascript

fetch('/api/api-keys',
{
  method: 'GET'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.get '/api/api-keys',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.get('/api/api-keys')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('GET','/api/api-keys', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/api-keys");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("GET");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("GET", "/api/api-keys", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`GET /api/api-keys`

<h3 id="apikeyscontroller_list-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ApiKeysController_create

<a id="opIdApiKeysController_create"></a>

> Code samples

```shell
# You can also use wget
curl -X POST /api/api-keys

```

```http
POST /api/api-keys HTTP/1.1

```

```javascript

fetch('/api/api-keys',
{
  method: 'POST'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.post '/api/api-keys',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.post('/api/api-keys')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('POST','/api/api-keys', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/api-keys");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("POST");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("POST", "/api/api-keys", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`POST /api/api-keys`

<h3 id="apikeyscontroller_create-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

## ApiKeysController_revoke

<a id="opIdApiKeysController_revoke"></a>

> Code samples

```shell
# You can also use wget
curl -X DELETE /api/api-keys/{id}

```

```http
DELETE /api/api-keys/{id} HTTP/1.1

```

```javascript

fetch('/api/api-keys/{id}',
{
  method: 'DELETE'

})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```ruby
require 'rest-client'
require 'json'

result = RestClient.delete '/api/api-keys/{id}',
  params: {
  }

p JSON.parse(result)

```

```python
import requests

r = requests.delete('/api/api-keys/{id}')

print(r.json())

```

```php
<?php

require 'vendor/autoload.php';

$client = new \GuzzleHttp\Client();

// Define array of request body.
$request_body = array();

try {
    $response = $client->request('DELETE','/api/api-keys/{id}', array(
        'headers' => $headers,
        'json' => $request_body,
       )
    );
    print_r($response->getBody()->getContents());
 }
 catch (\GuzzleHttp\Exception\BadResponseException $e) {
    // handle exception or api errors.
    print_r($e->getMessage());
 }

 // ...

```

```java
URL obj = new URL("/api/api-keys/{id}");
HttpURLConnection con = (HttpURLConnection) obj.openConnection();
con.setRequestMethod("DELETE");
int responseCode = con.getResponseCode();
BufferedReader in = new BufferedReader(
    new InputStreamReader(con.getInputStream()));
String inputLine;
StringBuffer response = new StringBuffer();
while ((inputLine = in.readLine()) != null) {
    response.append(inputLine);
}
in.close();
System.out.println(response.toString());

```

```go
package main

import (
       "bytes"
       "net/http"
)

func main() {

    data := bytes.NewBuffer([]byte{jsonReq})
    req, err := http.NewRequest("DELETE", "/api/api-keys/{id}", data)
    req.Header = headers

    client := &http.Client{}
    resp, err := client.Do(req)
    // ...
}

```

`DELETE /api/api-keys/{id}`

<h3 id="apikeyscontroller_revoke-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|id|path|string|true|none|

<h3 id="apikeyscontroller_revoke-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|None|

<aside class="success">
This operation does not require authentication
</aside>

# Schemas

<h2 id="tocS_LoginDto">LoginDto</h2>
<!-- backwards compatibility -->
<a id="schemalogindto"></a>
<a id="schema_LoginDto"></a>
<a id="tocSlogindto"></a>
<a id="tocslogindto"></a>

```json
{
  "username": "string",
  "password": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|username|string|true|none|none|
|password|string|true|none|none|

<h2 id="tocS_CreateAccountDto">CreateAccountDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateaccountdto"></a>
<a id="schema_CreateAccountDto"></a>
<a id="tocScreateaccountdto"></a>
<a id="tocscreateaccountdto"></a>

```json
{
  "customerNumber": "string",
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "primaryContactName": "string",
  "primaryContactEmail": "user@example.com",
  "primaryContactPhone": "string",
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "parentCustomerId": "3a73731b-67c3-4488-bb86-fd6f63111ed4",
  "taxCategoryId": "7293cae9-1ff3-4c2d-8fef-c6490a737060",
  "currencyCode": "string",
  "customerDiscount": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|customerNumber|string|true|none|none|
|name|string|true|none|none|
|address1Line1|string|false|none|none|
|address1Line2|string|false|none|none|
|address1City|string|false|none|none|
|address1StateOrProvince|string|false|none|none|
|address1PostalCode|string|false|none|none|
|address1Country|string|false|none|none|
|telephone1|string|false|none|none|
|fax|string|false|none|none|
|emailAddress1|string(email)|false|none|none|
|primaryContactName|string|false|none|none|
|primaryContactEmail|string(email)|false|none|none|
|primaryContactPhone|string|false|none|none|
|customerGroupId|string(uuid)|false|none|none|
|parentCustomerId|string(uuid)|false|none|none|
|taxCategoryId|string(uuid)|false|none|none|
|currencyCode|string|false|none|none|
|customerDiscount|string|false|none|none|
|notes|string|false|none|none|
|bankAccountName|string|false|none|none|
|bankBsb|string|false|none|none|
|bankAccountNumber|string|false|none|none|

<h2 id="tocS_UpdateAccountDto">UpdateAccountDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateaccountdto"></a>
<a id="schema_UpdateAccountDto"></a>
<a id="tocSupdateaccountdto"></a>
<a id="tocsupdateaccountdto"></a>

```json
{
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "primaryContactName": "string",
  "primaryContactEmail": "user@example.com",
  "primaryContactPhone": "string",
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "stateCode": "string",
  "parentCustomerId": "3a73731b-67c3-4488-bb86-fd6f63111ed4",
  "taxCategoryId": "7293cae9-1ff3-4c2d-8fef-c6490a737060",
  "currencyCode": "string",
  "customerDiscount": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|address1Line1|string|false|none|none|
|address1Line2|string|false|none|none|
|address1City|string|false|none|none|
|address1StateOrProvince|string|false|none|none|
|address1PostalCode|string|false|none|none|
|address1Country|string|false|none|none|
|telephone1|string|false|none|none|
|fax|string|false|none|none|
|emailAddress1|string(email)|false|none|none|
|primaryContactName|string|false|none|none|
|primaryContactEmail|string(email)|false|none|none|
|primaryContactPhone|string|false|none|none|
|customerGroupId|string(uuid)|false|none|none|
|stateCode|string|false|none|none|
|parentCustomerId|string(uuid)|false|none|none|
|taxCategoryId|string(uuid)|false|none|none|
|currencyCode|string|false|none|none|
|customerDiscount|string|false|none|none|
|notes|string|false|none|none|
|bankAccountName|string|false|none|none|
|bankBsb|string|false|none|none|
|bankAccountNumber|string|false|none|none|

<h2 id="tocS_CreateAccountGroupDto">CreateAccountGroupDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateaccountgroupdto"></a>
<a id="schema_CreateAccountGroupDto"></a>
<a id="tocScreateaccountgroupdto"></a>
<a id="tocscreateaccountgroupdto"></a>

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultDiscountPercentage": "string",
  "defaultArAccountId": "46ad366b-db2c-42d7-8db1-9f98ad689951",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|groupCode|string|true|none|none|
|name|string|true|none|none|
|defaultDiscountPercentage|string|false|none|none|
|defaultArAccountId|string(uuid)|false|none|none|
|defaultRevenueAccountId|string(uuid)|false|none|none|
|defaultCostCenterId|string(uuid)|false|none|none|
|defaultActivityId|string(uuid)|false|none|none|

<h2 id="tocS_UpdateAccountGroupDto">UpdateAccountGroupDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateaccountgroupdto"></a>
<a id="schema_UpdateAccountGroupDto"></a>
<a id="tocSupdateaccountgroupdto"></a>
<a id="tocsupdateaccountgroupdto"></a>

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultDiscountPercentage": "string",
  "defaultArAccountId": "46ad366b-db2c-42d7-8db1-9f98ad689951",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|groupCode|string|false|none|none|
|name|string|false|none|none|
|defaultDiscountPercentage|string|false|none|none|
|defaultArAccountId|string(uuid)|false|none|none|
|defaultRevenueAccountId|string(uuid)|false|none|none|
|defaultCostCenterId|string(uuid)|false|none|none|
|defaultActivityId|string(uuid)|false|none|none|

<h2 id="tocS_CreateProductDto">CreateProductDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateproductdto"></a>
<a id="schema_CreateProductDto"></a>
<a id="tocScreateproductdto"></a>
<a id="tocscreateproductdto"></a>

```json
{
  "productNumber": "string",
  "name": "string",
  "productType": {},
  "structureType": {},
  "barcode": "string",
  "listPrice": "string",
  "standardCost": "string",
  "tradePrice": "string",
  "priceLevel3": "string",
  "priceLevel4": "string",
  "purchaseTaxCategoryId": "11fec267-6c3d-4506-9298-0971e9aa3376",
  "salesTaxCategoryId": "cd956b50-0617-4a4c-8fe1-709bac4051e3",
  "alternateProductNumber": "string",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "notes": "string",
  "stateCode": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|productNumber|string|true|none|none|
|name|string|true|none|none|
|productType|object|false|none|none|
|structureType|object|false|none|none|
|barcode|string|false|none|none|
|listPrice|string|false|none|none|
|standardCost|string|false|none|none|
|tradePrice|string|false|none|none|
|priceLevel3|string|false|none|none|
|priceLevel4|string|false|none|none|
|purchaseTaxCategoryId|string(uuid)|false|none|none|
|salesTaxCategoryId|string(uuid)|false|none|none|
|alternateProductNumber|string|false|none|none|
|productGroupId|string(uuid)|false|none|none|
|notes|string|false|none|none|
|stateCode|string|false|none|none|

<h2 id="tocS_UpdateProductDto">UpdateProductDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateproductdto"></a>
<a id="schema_UpdateProductDto"></a>
<a id="tocSupdateproductdto"></a>
<a id="tocsupdateproductdto"></a>

```json
{
  "productNumber": "string",
  "name": "string",
  "productType": {},
  "structureType": {},
  "barcode": "string",
  "listPrice": "string",
  "standardCost": "string",
  "tradePrice": "string",
  "priceLevel3": "string",
  "priceLevel4": "string",
  "purchaseTaxCategoryId": "11fec267-6c3d-4506-9298-0971e9aa3376",
  "salesTaxCategoryId": "cd956b50-0617-4a4c-8fe1-709bac4051e3",
  "alternateProductNumber": "string",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "notes": "string",
  "stateCode": "string",
  "baseUom": "string",
  "defaultSalesUomId": "e98bfa36-b509-495e-a274-1c22bbc3d351",
  "defaultPurchaseUomId": "42701981-555a-470b-9596-2acd8c029026"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|productNumber|string|false|none|none|
|name|string|false|none|none|
|productType|object|false|none|none|
|structureType|object|false|none|none|
|barcode|string|false|none|none|
|listPrice|string|false|none|none|
|standardCost|string|false|none|none|
|tradePrice|string|false|none|none|
|priceLevel3|string|false|none|none|
|priceLevel4|string|false|none|none|
|purchaseTaxCategoryId|string(uuid)|false|none|none|
|salesTaxCategoryId|string(uuid)|false|none|none|
|alternateProductNumber|string|false|none|none|
|productGroupId|string(uuid)|false|none|none|
|notes|string|false|none|none|
|stateCode|string|false|none|none|
|baseUom|string|false|none|none|
|defaultSalesUomId|string(uuid)¦null|false|none|none|
|defaultPurchaseUomId|string(uuid)¦null|false|none|none|

<h2 id="tocS_AddSupplierDto">AddSupplierDto</h2>
<!-- backwards compatibility -->
<a id="schemaaddsupplierdto"></a>
<a id="schema_AddSupplierDto"></a>
<a id="tocSaddsupplierdto"></a>
<a id="tocsaddsupplierdto"></a>

```json
{
  "vendorId": "e9b57fab-1850-44d4-8499-71fd15c845a0",
  "supplierPartNumber": "string",
  "costPrice": 0,
  "effectiveFrom": "string",
  "effectiveTo": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|vendorId|string(uuid)|true|none|none|
|supplierPartNumber|string|false|none|none|
|costPrice|number|false|none|none|
|effectiveFrom|string|false|none|none|
|effectiveTo|string|false|none|none|

<h2 id="tocS_LinkBinDto">LinkBinDto</h2>
<!-- backwards compatibility -->
<a id="schemalinkbindto"></a>
<a id="schema_LinkBinDto"></a>
<a id="tocSlinkbindto"></a>
<a id="tocslinkbindto"></a>

```json
{
  "locationId": "1a5515a3-ba81-4a42-aee7-ad9ffc090a54",
  "binId": "bb3ec690-443a-44a2-b217-5deec3a3c27e",
  "isPrimaryPerLocation": true,
  "minQuantity": "string",
  "maxQuantity": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|locationId|string(uuid)|true|none|none|
|binId|string(uuid)|true|none|none|
|isPrimaryPerLocation|boolean|false|none|none|
|minQuantity|string|false|none|none|
|maxQuantity|string|false|none|none|

<h2 id="tocS_CreateProductGroupDto">CreateProductGroupDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateproductgroupdto"></a>
<a id="schema_CreateProductGroupDto"></a>
<a id="tocScreateproductgroupdto"></a>
<a id="tocscreateproductgroupdto"></a>

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|groupCode|string|true|none|none|
|name|string|true|none|none|
|defaultRevenueAccountId|string(uuid)|false|none|none|
|defaultExpenseAccountId|string(uuid)|false|none|none|
|defaultCostCenterId|string(uuid)|false|none|none|
|defaultActivityId|string(uuid)|false|none|none|

<h2 id="tocS_UpdateProductGroupDto">UpdateProductGroupDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateproductgroupdto"></a>
<a id="schema_UpdateProductGroupDto"></a>
<a id="tocSupdateproductgroupdto"></a>
<a id="tocsupdateproductgroupdto"></a>

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultRevenueAccountId": "7d658c64-5a05-4a8a-938f-0e0acf730d98",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|groupCode|string|false|none|none|
|name|string|false|none|none|
|defaultRevenueAccountId|string(uuid)|false|none|none|
|defaultExpenseAccountId|string(uuid)|false|none|none|
|defaultCostCenterId|string(uuid)|false|none|none|
|defaultActivityId|string(uuid)|false|none|none|

<h2 id="tocS_PutawayLineDto">PutawayLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaputawaylinedto"></a>
<a id="schema_PutawayLineDto"></a>
<a id="tocSputawaylinedto"></a>
<a id="tocsputawaylinedto"></a>

```json
{
  "lineId": "string",
  "sourceType": "goods_receipt",
  "destinationBinId": "string",
  "quantity": "string",
  "newTotalQuantity": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|lineId|string|true|none|none|
|sourceType|string|true|none|none|
|destinationBinId|string|true|none|none|
|quantity|string|true|none|none|
|newTotalQuantity|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|sourceType|goods_receipt|
|sourceType|sales_return|

<h2 id="tocS_PutawayBulkDto">PutawayBulkDto</h2>
<!-- backwards compatibility -->
<a id="schemaputawaybulkdto"></a>
<a id="schema_PutawayBulkDto"></a>
<a id="tocSputawaybulkdto"></a>
<a id="tocsputawaybulkdto"></a>

```json
{
  "putaways": [
    {
      "lineId": "string",
      "sourceType": "goods_receipt",
      "destinationBinId": "string",
      "quantity": "string",
      "newTotalQuantity": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|putaways|[[PutawayLineDto](#schemaputawaylinedto)]|true|none|none|

<h2 id="tocS_ToggleQuarantineDto">ToggleQuarantineDto</h2>
<!-- backwards compatibility -->
<a id="schematogglequarantinedto"></a>
<a id="schema_ToggleQuarantineDto"></a>
<a id="tocStogglequarantinedto"></a>
<a id="tocstogglequarantinedto"></a>

```json
{
  "sourceType": "goods_receipt",
  "reason": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|sourceType|string|true|none|none|
|reason|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|sourceType|goods_receipt|
|sourceType|sales_return|

<h2 id="tocS_CreateReconciliationDto">CreateReconciliationDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatereconciliationdto"></a>
<a id="schema_CreateReconciliationDto"></a>
<a id="tocScreatereconciliationdto"></a>
<a id="tocscreatereconciliationdto"></a>

```json
{
  "glAccountId": "string",
  "statementDate": "string",
  "statementBalance": 0,
  "createdBy": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|glAccountId|string|true|none|none|
|statementDate|string|true|none|none|
|statementBalance|number|true|none|none|
|createdBy|string|false|none|none|

<h2 id="tocS_ToggleLineDto">ToggleLineDto</h2>
<!-- backwards compatibility -->
<a id="schematogglelinedto"></a>
<a id="schema_ToggleLineDto"></a>
<a id="tocStogglelinedto"></a>
<a id="tocstogglelinedto"></a>

```json
{
  "isCleared": true,
  "amount": 0
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|isCleared|boolean|true|none|none|
|amount|number|false|none|none|

<h2 id="tocS_CreateAdjustmentDto">CreateAdjustmentDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateadjustmentdto"></a>
<a id="schema_CreateAdjustmentDto"></a>
<a id="tocScreateadjustmentdto"></a>
<a id="tocscreateadjustmentdto"></a>

```json
{
  "date": "string",
  "amount": 0,
  "type": {},
  "offsetAccountId": "string",
  "memo": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|date|string|true|none|none|
|amount|number|true|none|none|
|type|object|true|none|none|
|offsetAccountId|string|true|none|none|
|memo|string|true|none|none|

<h2 id="tocS_CreateUomDto">CreateUomDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateuomdto"></a>
<a id="schema_CreateUomDto"></a>
<a id="tocScreateuomdto"></a>
<a id="tocscreateuomdto"></a>

```json
{
  "uomCode": "string",
  "description": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|uomCode|string|true|none|none|
|description|string|true|none|none|

<h2 id="tocS_UpdateUomDto">UpdateUomDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateuomdto"></a>
<a id="schema_UpdateUomDto"></a>
<a id="tocSupdateuomdto"></a>
<a id="tocsupdateuomdto"></a>

```json
{
  "description": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|description|string|false|none|none|

<h2 id="tocS_CreateExchangeRateDto">CreateExchangeRateDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateexchangeratedto"></a>
<a id="schema_CreateExchangeRateDto"></a>
<a id="tocScreateexchangeratedto"></a>
<a id="tocscreateexchangeratedto"></a>

```json
{
  "currencyCode": "string",
  "currencyName": "string",
  "buyRate": "string",
  "sellRate": "string",
  "effectiveDate": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|currencyCode|string|true|none|none|
|currencyName|string|true|none|none|
|buyRate|string|true|none|none|
|sellRate|string|true|none|none|
|effectiveDate|string|false|none|none|

<h2 id="tocS_UpdateExchangeRateDto">UpdateExchangeRateDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateexchangeratedto"></a>
<a id="schema_UpdateExchangeRateDto"></a>
<a id="tocSupdateexchangeratedto"></a>
<a id="tocsupdateexchangeratedto"></a>

```json
{
  "currencyName": "string",
  "buyRate": "string",
  "sellRate": "string",
  "effectiveDate": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|currencyName|string|false|none|none|
|buyRate|string|false|none|none|
|sellRate|string|false|none|none|
|effectiveDate|string|false|none|none|

<h2 id="tocS_UpdateOrganizationDto">UpdateOrganizationDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateorganizationdto"></a>
<a id="schema_UpdateOrganizationDto"></a>
<a id="tocSupdateorganizationdto"></a>
<a id="tocsupdateorganizationdto"></a>

```json
{
  "name": "string",
  "addressLine1": "string",
  "addressLine2": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postCode": "string",
  "email": "user@example.com",
  "phone": "string",
  "website": "http://example.com",
  "companyNumber": "string",
  "taxNumber": "string",
  "logoUrl": "http://example.com",
  "bankName": "string",
  "bankAccountName": "string",
  "bankAccountNumber": "string",
  "bankSwiftBic": "string",
  "bankIban": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|true|none|none|
|addressLine1|string|false|none|none|
|addressLine2|string|false|none|none|
|city|string|false|none|none|
|state|string|false|none|none|
|country|string|false|none|none|
|postCode|string|false|none|none|
|email|string(email)|false|none|none|
|phone|string|false|none|none|
|website|string(uri)|false|none|none|
|companyNumber|string|false|none|none|
|taxNumber|string|false|none|none|
|logoUrl|string(uri)|false|none|none|
|bankName|string|false|none|none|
|bankAccountName|string|false|none|none|
|bankAccountNumber|string|false|none|none|
|bankSwiftBic|string|false|none|none|
|bankIban|string|false|none|none|

<h2 id="tocS_CreateCostCenterDto">CreateCostCenterDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatecostcenterdto"></a>
<a id="schema_CreateCostCenterDto"></a>
<a id="tocScreatecostcenterdto"></a>
<a id="tocscreatecostcenterdto"></a>

```json
{
  "code": "string",
  "name": "string",
  "isActive": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|code|string|true|none|none|
|name|string|true|none|none|
|isActive|boolean|false|none|none|

<h2 id="tocS_UpdateCostCenterDto">UpdateCostCenterDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatecostcenterdto"></a>
<a id="schema_UpdateCostCenterDto"></a>
<a id="tocSupdatecostcenterdto"></a>
<a id="tocsupdatecostcenterdto"></a>

```json
{
  "name": "string",
  "isActive": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|isActive|boolean|false|none|none|

<h2 id="tocS_BulkImportResultDto">BulkImportResultDto</h2>
<!-- backwards compatibility -->
<a id="schemabulkimportresultdto"></a>
<a id="schema_BulkImportResultDto"></a>
<a id="tocSbulkimportresultdto"></a>
<a id="tocsbulkimportresultdto"></a>

```json
{
  "count": 0,
  "updated": 0
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|count|number|true|none|none|
|updated|number|true|none|none|

<h2 id="tocS_CreateActivityDto">CreateActivityDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateactivitydto"></a>
<a id="schema_CreateActivityDto"></a>
<a id="tocScreateactivitydto"></a>
<a id="tocscreateactivitydto"></a>

```json
{
  "code": "string",
  "name": "string",
  "isActive": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|code|string|true|none|none|
|name|string|true|none|none|
|isActive|boolean|false|none|none|

<h2 id="tocS_UpdateActivityDto">UpdateActivityDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateactivitydto"></a>
<a id="schema_UpdateActivityDto"></a>
<a id="tocSupdateactivitydto"></a>
<a id="tocsupdateactivitydto"></a>

```json
{
  "name": "string",
  "isActive": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|isActive|boolean|false|none|none|

<h2 id="tocS_CreateOrderLineDto">CreateOrderLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateorderlinedto"></a>
<a id="schema_CreateOrderLineDto"></a>
<a id="tocScreateorderlinedto"></a>
<a id="tocscreateorderlinedto"></a>

```json
{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|productId|string|false|none|none|
|productDescription|string|false|none|none|
|quantity|string|true|none|none|
|pricePerUnit|string|true|none|none|
|discountPercentage|string|false|none|none|
|taxCategoryId|string|false|none|none|
|unitOfMeasure|string|false|none|none|
|fulfillmentLocationId|string|false|none|none|

<h2 id="tocS_CreateOrderDto">CreateOrderDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateorderdto"></a>
<a id="schema_CreateOrderDto"></a>
<a id="tocScreateorderdto"></a>
<a id="tocscreateorderdto"></a>

```json
{
  "name": "string",
  "customerId": "string",
  "customerOrderNumber": "string",
  "notes": "string",
  "fulfillmentLocationId": "string",
  "lines": [
    {
      "productId": "string",
      "productDescription": "string",
      "quantity": "string",
      "pricePerUnit": "string",
      "discountPercentage": "string",
      "taxCategoryId": "string",
      "unitOfMeasure": "string",
      "fulfillmentLocationId": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|customerId|string|true|none|none|
|customerOrderNumber|string|false|none|none|
|notes|string|false|none|none|
|fulfillmentLocationId|string|false|none|none|
|lines|[[CreateOrderLineDto](#schemacreateorderlinedto)]|true|none|none|

<h2 id="tocS_UpdateOrderDto">UpdateOrderDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateorderdto"></a>
<a id="schema_UpdateOrderDto"></a>
<a id="tocSupdateorderdto"></a>
<a id="tocsupdateorderdto"></a>

```json
{
  "name": "string",
  "customerOrderNumber": "string",
  "notes": "string",
  "fulfillmentLocationId": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|customerOrderNumber|string|false|none|none|
|notes|string|false|none|none|
|fulfillmentLocationId|string|false|none|none|

<h2 id="tocS_UpdateOrderLineDto">UpdateOrderLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateorderlinedto"></a>
<a id="schema_UpdateOrderLineDto"></a>
<a id="tocSupdateorderlinedto"></a>
<a id="tocsupdateorderlinedto"></a>

```json
{
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "taxCategoryId": "string",
  "productDescription": "string",
  "unitOfMeasure": "string",
  "fulfillmentLocationId": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|quantity|string|false|none|none|
|pricePerUnit|string|false|none|none|
|discountPercentage|string|false|none|none|
|taxCategoryId|string|false|none|none|
|productDescription|string|false|none|none|
|unitOfMeasure|string|false|none|none|
|fulfillmentLocationId|string|false|none|none|

<h2 id="tocS_CreateReturnLineDto">CreateReturnLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatereturnlinedto"></a>
<a id="schema_CreateReturnLineDto"></a>
<a id="tocScreatereturnlinedto"></a>
<a id="tocscreatereturnlinedto"></a>

```json
{
  "salesOrderLineId": "string",
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|salesOrderLineId|string|true|none|none|
|quantityReturned|string|true|none|none|
|reason|string|false|none|none|
|returnFee|string|false|none|none|

<h2 id="tocS_CreateReturnDto">CreateReturnDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatereturndto"></a>
<a id="schema_CreateReturnDto"></a>
<a id="tocScreatereturndto"></a>
<a id="tocscreatereturndto"></a>

```json
{
  "notes": "string",
  "lines": [
    {
      "salesOrderLineId": "string",
      "quantityReturned": "string",
      "reason": "string",
      "returnFee": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|notes|string|false|none|none|
|lines|[[CreateReturnLineDto](#schemacreatereturnlinedto)]|true|none|none|

<h2 id="tocS_UpdateReturnDto">UpdateReturnDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatereturndto"></a>
<a id="schema_UpdateReturnDto"></a>
<a id="tocSupdatereturndto"></a>
<a id="tocsupdatereturndto"></a>

```json
{
  "notes": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|notes|string|false|none|none|

<h2 id="tocS_AddReturnLineDto">AddReturnLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaaddreturnlinedto"></a>
<a id="schema_AddReturnLineDto"></a>
<a id="tocSaddreturnlinedto"></a>
<a id="tocsaddreturnlinedto"></a>

```json
{
  "salesOrderLineId": "string",
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|salesOrderLineId|string|true|none|none|
|quantityReturned|string|true|none|none|
|reason|string|false|none|none|
|returnFee|string|false|none|none|

<h2 id="tocS_UpdateReturnLineDto">UpdateReturnLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatereturnlinedto"></a>
<a id="schema_UpdateReturnLineDto"></a>
<a id="tocSupdatereturnlinedto"></a>
<a id="tocsupdatereturnlinedto"></a>

```json
{
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|quantityReturned|string|false|none|none|
|reason|string|false|none|none|
|returnFee|string|false|none|none|

<h2 id="tocS_ReceiveReturnLineDto">ReceiveReturnLineDto</h2>
<!-- backwards compatibility -->
<a id="schemareceivereturnlinedto"></a>
<a id="schema_ReceiveReturnLineDto"></a>
<a id="tocSreceivereturnlinedto"></a>
<a id="tocsreceivereturnlinedto"></a>

```json
{
  "returnLineId": "string",
  "quantityReceived": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|returnLineId|string|true|none|none|
|quantityReceived|string|true|none|none|

<h2 id="tocS_ReceiveReturnDto">ReceiveReturnDto</h2>
<!-- backwards compatibility -->
<a id="schemareceivereturndto"></a>
<a id="schema_ReceiveReturnDto"></a>
<a id="tocSreceivereturndto"></a>
<a id="tocsreceivereturndto"></a>

```json
{
  "locationId": "string",
  "lines": [
    {
      "returnLineId": "string",
      "quantityReceived": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|locationId|string|true|none|none|
|lines|[[ReceiveReturnLineDto](#schemareceivereturnlinedto)]|true|none|none|

<h2 id="tocS_CreateShipmentLineDto">CreateShipmentLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateshipmentlinedto"></a>
<a id="schema_CreateShipmentLineDto"></a>
<a id="tocScreateshipmentlinedto"></a>
<a id="tocscreateshipmentlinedto"></a>

```json
{
  "salesOrderLineId": "string",
  "quantityShipped": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|salesOrderLineId|string|true|none|none|
|quantityShipped|string|true|none|none|

<h2 id="tocS_CreateShipmentDto">CreateShipmentDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateshipmentdto"></a>
<a id="schema_CreateShipmentDto"></a>
<a id="tocScreateshipmentdto"></a>
<a id="tocscreateshipmentdto"></a>

```json
{
  "notes": "string",
  "trackingNumber": "string",
  "lines": [
    {
      "salesOrderLineId": "string",
      "quantityShipped": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|notes|string|false|none|none|
|trackingNumber|string|false|none|none|
|lines|[[CreateShipmentLineDto](#schemacreateshipmentlinedto)]|true|none|none|

<h2 id="tocS_UpdateShipmentDto">UpdateShipmentDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateshipmentdto"></a>
<a id="schema_UpdateShipmentDto"></a>
<a id="tocSupdateshipmentdto"></a>
<a id="tocsupdateshipmentdto"></a>

```json
{
  "notes": "string",
  "trackingNumber": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|notes|string|false|none|none|
|trackingNumber|string|false|none|none|

<h2 id="tocS_AddShipmentLineDto">AddShipmentLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaaddshipmentlinedto"></a>
<a id="schema_AddShipmentLineDto"></a>
<a id="tocSaddshipmentlinedto"></a>
<a id="tocsaddshipmentlinedto"></a>

```json
{
  "salesOrderLineId": "string",
  "quantityShipped": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|salesOrderLineId|string|true|none|none|
|quantityShipped|string|true|none|none|

<h2 id="tocS_UpdateShipmentLineDto">UpdateShipmentLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateshipmentlinedto"></a>
<a id="schema_UpdateShipmentLineDto"></a>
<a id="tocSupdateshipmentlinedto"></a>
<a id="tocsupdateshipmentlinedto"></a>

```json
{
  "quantityShipped": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|quantityShipped|string|false|none|none|

<h2 id="tocS_CreateTransferOrderLineDto">CreateTransferOrderLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatetransferorderlinedto"></a>
<a id="schema_CreateTransferOrderLineDto"></a>
<a id="tocScreatetransferorderlinedto"></a>
<a id="tocscreatetransferorderlinedto"></a>

```json
{
  "productId": "string",
  "quantity": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|productId|string|true|none|none|
|quantity|string|true|none|none|

<h2 id="tocS_CreateTransferOrderDto">CreateTransferOrderDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatetransferorderdto"></a>
<a id="schema_CreateTransferOrderDto"></a>
<a id="tocScreatetransferorderdto"></a>
<a id="tocscreatetransferorderdto"></a>

```json
{
  "sourceLocationId": "string",
  "destinationLocationId": "string",
  "notes": "string",
  "lines": [
    {
      "productId": "string",
      "quantity": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|sourceLocationId|string|true|none|none|
|destinationLocationId|string|true|none|none|
|notes|string|false|none|none|
|lines|[[CreateTransferOrderLineDto](#schemacreatetransferorderlinedto)]|true|none|none|

<h2 id="tocS_UpdateTransferOrderDto">UpdateTransferOrderDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatetransferorderdto"></a>
<a id="schema_UpdateTransferOrderDto"></a>
<a id="tocSupdatetransferorderdto"></a>
<a id="tocsupdatetransferorderdto"></a>

```json
{
  "sourceLocationId": "string",
  "destinationLocationId": "string",
  "notes": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|sourceLocationId|string|false|none|none|
|destinationLocationId|string|false|none|none|
|notes|string|false|none|none|

<h2 id="tocS_UpdateTransferOrderLineDto">UpdateTransferOrderLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatetransferorderlinedto"></a>
<a id="schema_UpdateTransferOrderLineDto"></a>
<a id="tocSupdatetransferorderlinedto"></a>
<a id="tocsupdatetransferorderlinedto"></a>

```json
{
  "quantity": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|quantity|string|false|none|none|

<h2 id="tocS_CreateTaxCategoryDto">CreateTaxCategoryDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatetaxcategorydto"></a>
<a id="schema_CreateTaxCategoryDto"></a>
<a id="tocScreatetaxcategorydto"></a>
<a id="tocscreatetaxcategorydto"></a>

```json
{
  "code": "string",
  "title": "string",
  "type": {},
  "rate": "string",
  "isDefault": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|code|string|true|none|none|
|title|string|true|none|none|
|type|object|true|none|none|
|rate|string|false|none|none|
|isDefault|boolean|false|none|none|

<h2 id="tocS_UpdateTaxCategoryDto">UpdateTaxCategoryDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatetaxcategorydto"></a>
<a id="schema_UpdateTaxCategoryDto"></a>
<a id="tocSupdatetaxcategorydto"></a>
<a id="tocsupdatetaxcategorydto"></a>

```json
{
  "code": "string",
  "title": "string",
  "type": {},
  "rate": "string",
  "isDefault": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|code|string|false|none|none|
|title|string|false|none|none|
|type|object|false|none|none|
|rate|string|false|none|none|
|isDefault|boolean|false|none|none|

<h2 id="tocS_CreateSalesInvoiceLineDto">CreateSalesInvoiceLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatesalesinvoicelinedto"></a>
<a id="schema_CreateSalesInvoiceLineDto"></a>
<a id="tocScreatesalesinvoicelinedto"></a>
<a id="tocscreatesalesinvoicelinedto"></a>

```json
{
  "salesOrderLineId": "c841d696-011a-47e7-96c4-3081b0e83472",
  "quantityToInvoice": 0
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|salesOrderLineId|string(uuid)|true|none|none|
|quantityToInvoice|number|true|none|none|

<h2 id="tocS_CreateSalesInvoiceDto">CreateSalesInvoiceDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatesalesinvoicedto"></a>
<a id="schema_CreateSalesInvoiceDto"></a>
<a id="tocScreatesalesinvoicedto"></a>
<a id="tocscreatesalesinvoicedto"></a>

```json
{
  "notes": "string",
  "lines": [
    {
      "salesOrderLineId": "c841d696-011a-47e7-96c4-3081b0e83472",
      "quantityToInvoice": 0
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|notes|string|false|none|none|
|lines|[[CreateSalesInvoiceLineDto](#schemacreatesalesinvoicelinedto)]|false|none|none|

<h2 id="tocS_CreatePaymentDto">CreatePaymentDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatepaymentdto"></a>
<a id="schema_CreatePaymentDto"></a>
<a id="tocScreatepaymentdto"></a>
<a id="tocscreatepaymentdto"></a>

```json
{
  "paymentType": {},
  "partyType": {},
  "partyId": "950a3d1f-4657-4e7b-87db-3ff5fa95b5c0",
  "paymentDate": "string",
  "modeOfPayment": {},
  "totalAmount": 0.01,
  "glAccountBank": "3e17db10-cc97-4597-bae0-c76c1a013e5b",
  "referenceNumber": "string",
  "currencyCode": "string",
  "submitImmediately": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|paymentType|object|true|none|none|
|partyType|object|true|none|none|
|partyId|string(uuid)|true|none|none|
|paymentDate|string|true|none|none|
|modeOfPayment|object|true|none|none|
|totalAmount|number|true|none|none|
|glAccountBank|string(uuid)|true|none|none|
|referenceNumber|string|false|none|none|
|currencyCode|string|true|none|none|
|submitImmediately|boolean|false|none|none|

<h2 id="tocS_AllocationDto">AllocationDto</h2>
<!-- backwards compatibility -->
<a id="schemaallocationdto"></a>
<a id="schema_AllocationDto"></a>
<a id="tocSallocationdto"></a>
<a id="tocsallocationdto"></a>

```json
{
  "referenceType": {},
  "referenceId": "8502eb05-558d-4480-8511-c1011710b340",
  "allocatedAmount": 0.01
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|referenceType|object|true|none|none|
|referenceId|string(uuid)|true|none|none|
|allocatedAmount|number|true|none|none|

<h2 id="tocS_AllocatePaymentDto">AllocatePaymentDto</h2>
<!-- backwards compatibility -->
<a id="schemaallocatepaymentdto"></a>
<a id="schema_AllocatePaymentDto"></a>
<a id="tocSallocatepaymentdto"></a>
<a id="tocsallocatepaymentdto"></a>

```json
{
  "allocations": [
    {
      "referenceType": {},
      "referenceId": "8502eb05-558d-4480-8511-c1011710b340",
      "allocatedAmount": 0.01
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|allocations|[[AllocationDto](#schemaallocationdto)]|true|none|none|

<h2 id="tocS_BatchPaymentActionDto">BatchPaymentActionDto</h2>
<!-- backwards compatibility -->
<a id="schemabatchpaymentactiondto"></a>
<a id="schema_BatchPaymentActionDto"></a>
<a id="tocSbatchpaymentactiondto"></a>
<a id="tocsbatchpaymentactiondto"></a>

```json
{
  "paymentIds": [
    "string"
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|paymentIds|[string]|true|none|none|

<h2 id="tocS_ClientErrorDto">ClientErrorDto</h2>
<!-- backwards compatibility -->
<a id="schemaclienterrordto"></a>
<a id="schema_ClientErrorDto"></a>
<a id="tocSclienterrordto"></a>
<a id="tocsclienterrordto"></a>

```json
{
  "message": "string",
  "stack": "string",
  "component": "string",
  "url": "http://example.com"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|message|string|true|none|none|
|stack|string|false|none|none|
|component|string|false|none|none|
|url|string(uri)|false|none|none|

<h2 id="tocS_CreateSupplierDto">CreateSupplierDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatesupplierdto"></a>
<a id="schema_CreateSupplierDto"></a>
<a id="tocScreatesupplierdto"></a>
<a id="tocscreatesupplierdto"></a>

```json
{
  "vendorNumber": "string",
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "supplierGroupId": "d5da6b63-b552-4b08-8172-bee7d785a20a",
  "currencyCode": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|vendorNumber|string|true|none|none|
|name|string|true|none|none|
|address1Line1|string|false|none|none|
|address1Line2|string|false|none|none|
|address1City|string|false|none|none|
|address1StateOrProvince|string|false|none|none|
|address1PostalCode|string|false|none|none|
|address1Country|string|false|none|none|
|telephone1|string|false|none|none|
|fax|string|false|none|none|
|emailAddress1|string(email)|false|none|none|
|tradingTermsId|string(uuid)|false|none|none|
|earlyPaymentDiscount|string|false|none|none|
|creditLimit|string|false|none|none|
|isPurchasingBlocked|boolean|false|none|none|
|purchasingBlockReason|string|false|none|none|
|isPaymentBlocked|boolean|false|none|none|
|paymentBlockReason|string|false|none|none|
|blockNotes|string|false|none|none|
|supplierGroupId|string(uuid)|false|none|none|
|currencyCode|string|false|none|none|
|notes|string|false|none|none|
|bankAccountName|string|false|none|none|
|bankBsb|string|false|none|none|
|bankAccountNumber|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|purchasingBlockReason|compliance_breach|
|purchasingBlockReason|quality_issues|
|purchasingBlockReason|dispute|
|purchasingBlockReason|financial_risk|
|purchasingBlockReason|other|
|paymentBlockReason|invoice_dispute|
|paymentBlockReason|missing_goods|
|paymentBlockReason|contractual_breach|
|paymentBlockReason|other|

<h2 id="tocS_UpdateSupplierDto">UpdateSupplierDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatesupplierdto"></a>
<a id="schema_UpdateSupplierDto"></a>
<a id="tocSupdatesupplierdto"></a>
<a id="tocsupdatesupplierdto"></a>

```json
{
  "name": "string",
  "address1Line1": "string",
  "address1Line2": "string",
  "address1City": "string",
  "address1StateOrProvince": "string",
  "address1PostalCode": "string",
  "address1Country": "string",
  "telephone1": "string",
  "fax": "string",
  "emailAddress1": "user@example.com",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "supplierGroupId": "d5da6b63-b552-4b08-8172-bee7d785a20a",
  "currencyCode": "string",
  "notes": "string",
  "bankAccountName": "string",
  "bankBsb": "string",
  "bankAccountNumber": "string",
  "stateCode": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|address1Line1|string|false|none|none|
|address1Line2|string|false|none|none|
|address1City|string|false|none|none|
|address1StateOrProvince|string|false|none|none|
|address1PostalCode|string|false|none|none|
|address1Country|string|false|none|none|
|telephone1|string|false|none|none|
|fax|string|false|none|none|
|emailAddress1|string(email)|false|none|none|
|tradingTermsId|string(uuid)|false|none|none|
|earlyPaymentDiscount|string|false|none|none|
|creditLimit|string|false|none|none|
|isPurchasingBlocked|boolean|false|none|none|
|purchasingBlockReason|string|false|none|none|
|isPaymentBlocked|boolean|false|none|none|
|paymentBlockReason|string|false|none|none|
|blockNotes|string|false|none|none|
|supplierGroupId|string(uuid)|false|none|none|
|currencyCode|string|false|none|none|
|notes|string|false|none|none|
|bankAccountName|string|false|none|none|
|bankBsb|string|false|none|none|
|bankAccountNumber|string|false|none|none|
|stateCode|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|purchasingBlockReason|compliance_breach|
|purchasingBlockReason|quality_issues|
|purchasingBlockReason|dispute|
|purchasingBlockReason|financial_risk|
|purchasingBlockReason|other|
|paymentBlockReason|invoice_dispute|
|paymentBlockReason|missing_goods|
|paymentBlockReason|contractual_breach|
|paymentBlockReason|other|

<h2 id="tocS_CreateSupplierExpiryDto">CreateSupplierExpiryDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatesupplierexpirydto"></a>
<a id="schema_CreateSupplierExpiryDto"></a>
<a id="tocScreatesupplierexpirydto"></a>
<a id="tocscreatesupplierexpirydto"></a>

```json
{
  "expiryType": "insurance",
  "expiryDate": "string",
  "notes": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|expiryType|string|true|none|none|
|expiryDate|string|true|none|none|
|notes|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|expiryType|insurance|
|expiryType|tax_certificate|
|expiryType|trial_period|
|expiryType|other|

<h2 id="tocS_UpdateSupplierExpiryDto">UpdateSupplierExpiryDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatesupplierexpirydto"></a>
<a id="schema_UpdateSupplierExpiryDto"></a>
<a id="tocSupdatesupplierexpirydto"></a>
<a id="tocsupdatesupplierexpirydto"></a>

```json
{
  "expiryType": "insurance",
  "expiryDate": "string",
  "notes": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|expiryType|string|false|none|none|
|expiryDate|string|false|none|none|
|notes|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|expiryType|insurance|
|expiryType|tax_certificate|
|expiryType|trial_period|
|expiryType|other|

<h2 id="tocS_CreateSupplierGroupDto">CreateSupplierGroupDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatesuppliergroupdto"></a>
<a id="schema_CreateSupplierGroupDto"></a>
<a id="tocScreatesuppliergroupdto"></a>
<a id="tocscreatesuppliergroupdto"></a>

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultApAccountId": "ab2ee3b9-3d2b-4859-bc6d-150439fa711c",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|groupCode|string|true|none|none|
|name|string|true|none|none|
|defaultApAccountId|string(uuid)|false|none|none|
|defaultExpenseAccountId|string(uuid)|false|none|none|
|tradingTermsId|string(uuid)|false|none|none|
|earlyPaymentDiscount|string|false|none|none|
|creditLimit|string|false|none|none|
|isPurchasingBlocked|boolean|false|none|none|
|purchasingBlockReason|string|false|none|none|
|isPaymentBlocked|boolean|false|none|none|
|paymentBlockReason|string|false|none|none|
|blockNotes|string|false|none|none|
|defaultCostCenterId|string(uuid)|false|none|none|
|defaultActivityId|string(uuid)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|purchasingBlockReason|compliance_breach|
|purchasingBlockReason|quality_issues|
|purchasingBlockReason|dispute|
|purchasingBlockReason|financial_risk|
|purchasingBlockReason|other|
|paymentBlockReason|invoice_dispute|
|paymentBlockReason|missing_goods|
|paymentBlockReason|contractual_breach|
|paymentBlockReason|other|

<h2 id="tocS_UpdateSupplierGroupDto">UpdateSupplierGroupDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatesuppliergroupdto"></a>
<a id="schema_UpdateSupplierGroupDto"></a>
<a id="tocSupdatesuppliergroupdto"></a>
<a id="tocsupdatesuppliergroupdto"></a>

```json
{
  "groupCode": "string",
  "name": "string",
  "defaultApAccountId": "ab2ee3b9-3d2b-4859-bc6d-150439fa711c",
  "defaultExpenseAccountId": "5ff8ef43-957f-4026-89b4-099d42300a93",
  "tradingTermsId": "cf8cc708-5b53-4996-af66-576d1199aca7",
  "earlyPaymentDiscount": "string",
  "creditLimit": "string",
  "isPurchasingBlocked": true,
  "purchasingBlockReason": "compliance_breach",
  "isPaymentBlocked": true,
  "paymentBlockReason": "invoice_dispute",
  "blockNotes": "string",
  "defaultCostCenterId": "d5a558b0-0e86-496c-8949-04b04d7832e3",
  "defaultActivityId": "d151ec0e-7490-4fe1-bf78-15de8fa926a7"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|groupCode|string|false|none|none|
|name|string|false|none|none|
|defaultApAccountId|string(uuid)|false|none|none|
|defaultExpenseAccountId|string(uuid)|false|none|none|
|tradingTermsId|string(uuid)|false|none|none|
|earlyPaymentDiscount|string|false|none|none|
|creditLimit|string|false|none|none|
|isPurchasingBlocked|boolean|false|none|none|
|purchasingBlockReason|string|false|none|none|
|isPaymentBlocked|boolean|false|none|none|
|paymentBlockReason|string|false|none|none|
|blockNotes|string|false|none|none|
|defaultCostCenterId|string(uuid)|false|none|none|
|defaultActivityId|string(uuid)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|purchasingBlockReason|compliance_breach|
|purchasingBlockReason|quality_issues|
|purchasingBlockReason|dispute|
|purchasingBlockReason|financial_risk|
|purchasingBlockReason|other|
|paymentBlockReason|invoice_dispute|
|paymentBlockReason|missing_goods|
|paymentBlockReason|contractual_breach|
|paymentBlockReason|other|

<h2 id="tocS_CreatePurchaseOrderLineDto">CreatePurchaseOrderLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatepurchaseorderlinedto"></a>
<a id="schema_CreatePurchaseOrderLineDto"></a>
<a id="tocScreatepurchaseorderlinedto"></a>
<a id="tocscreatepurchaseorderlinedto"></a>

```json
{
  "productId": "string",
  "productDescription": "string",
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "unitOfMeasure": "string",
  "taxCategoryId": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|productId|string|false|none|none|
|productDescription|string|false|none|none|
|quantity|string|true|none|none|
|pricePerUnit|string|true|none|none|
|discountPercentage|string|false|none|none|
|unitOfMeasure|string|false|none|none|
|taxCategoryId|string|false|none|none|

<h2 id="tocS_CreatePurchaseOrderDto">CreatePurchaseOrderDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatepurchaseorderdto"></a>
<a id="schema_CreatePurchaseOrderDto"></a>
<a id="tocScreatepurchaseorderdto"></a>
<a id="tocscreatepurchaseorderdto"></a>

```json
{
  "orderNumber": "string",
  "deliveryLocationId": "string",
  "name": "string",
  "vendorId": "string",
  "currencyCode": "string",
  "notes": "string",
  "referenceNumber": "string",
  "lines": [
    {
      "productId": "string",
      "productDescription": "string",
      "quantity": "string",
      "pricePerUnit": "string",
      "discountPercentage": "string",
      "unitOfMeasure": "string",
      "taxCategoryId": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|orderNumber|string|true|none|none|
|deliveryLocationId|string|true|none|none|
|name|string|false|none|none|
|vendorId|string|true|none|none|
|currencyCode|string|false|none|none|
|notes|string|false|none|none|
|referenceNumber|string|false|none|none|
|lines|[[CreatePurchaseOrderLineDto](#schemacreatepurchaseorderlinedto)]|false|none|none|

<h2 id="tocS_UpdatePurchaseOrderDto">UpdatePurchaseOrderDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatepurchaseorderdto"></a>
<a id="schema_UpdatePurchaseOrderDto"></a>
<a id="tocSupdatepurchaseorderdto"></a>
<a id="tocsupdatepurchaseorderdto"></a>

```json
{
  "name": "string",
  "vendorId": "string",
  "currencyCode": "string",
  "notes": "string",
  "referenceNumber": "string",
  "stateCode": "string",
  "deliveryLocationId": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|vendorId|string|false|none|none|
|currencyCode|string|false|none|none|
|notes|string|false|none|none|
|referenceNumber|string|false|none|none|
|stateCode|string|false|none|none|
|deliveryLocationId|string|false|none|none|

<h2 id="tocS_UpdatePurchaseOrderLineDto">UpdatePurchaseOrderLineDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatepurchaseorderlinedto"></a>
<a id="schema_UpdatePurchaseOrderLineDto"></a>
<a id="tocSupdatepurchaseorderlinedto"></a>
<a id="tocsupdatepurchaseorderlinedto"></a>

```json
{
  "quantity": "string",
  "pricePerUnit": "string",
  "discountPercentage": "string",
  "productDescription": "string",
  "unitOfMeasure": "string",
  "taxCategoryId": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|quantity|string|false|none|none|
|pricePerUnit|string|false|none|none|
|discountPercentage|string|false|none|none|
|productDescription|string|false|none|none|
|unitOfMeasure|string|false|none|none|
|taxCategoryId|string|false|none|none|

<h2 id="tocS_CreatePurchaseReturnLineDto">CreatePurchaseReturnLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatepurchasereturnlinedto"></a>
<a id="schema_CreatePurchaseReturnLineDto"></a>
<a id="tocScreatepurchasereturnlinedto"></a>
<a id="tocscreatepurchasereturnlinedto"></a>

```json
{
  "purchaseOrderLineId": "string",
  "quantityReturned": "string",
  "reason": "string",
  "returnFee": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|purchaseOrderLineId|string|true|none|none|
|quantityReturned|string|true|none|none|
|reason|string|false|none|none|
|returnFee|string|false|none|none|

<h2 id="tocS_CreatePurchaseReturnDto">CreatePurchaseReturnDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatepurchasereturndto"></a>
<a id="schema_CreatePurchaseReturnDto"></a>
<a id="tocScreatepurchasereturndto"></a>
<a id="tocscreatepurchasereturndto"></a>

```json
{
  "notes": "string",
  "lines": [
    {
      "purchaseOrderLineId": "string",
      "quantityReturned": "string",
      "reason": "string",
      "returnFee": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|notes|string|false|none|none|
|lines|[[CreatePurchaseReturnLineDto](#schemacreatepurchasereturnlinedto)]|true|none|none|

<h2 id="tocS_CreateDebitNoteLineDto">CreateDebitNoteLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatedebitnotelinedto"></a>
<a id="schema_CreateDebitNoteLineDto"></a>
<a id="tocScreatedebitnotelinedto"></a>
<a id="tocscreatedebitnotelinedto"></a>

```json
{
  "purchaseOrderLineId": "string",
  "quantityInvoiced": "string",
  "pricePerUnit": "string",
  "amount": "string",
  "taxAmount": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|purchaseOrderLineId|string|true|none|none|
|quantityInvoiced|string|true|none|none|
|pricePerUnit|string|true|none|none|
|amount|string|true|none|none|
|taxAmount|string|false|none|none|

<h2 id="tocS_CreateDebitNoteDto">CreateDebitNoteDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatedebitnotedto"></a>
<a id="schema_CreateDebitNoteDto"></a>
<a id="tocScreatedebitnotedto"></a>
<a id="tocscreatedebitnotedto"></a>

```json
{
  "returnId": "string",
  "supplierReferenceNumber": "string",
  "lines": [
    {
      "purchaseOrderLineId": "string",
      "quantityInvoiced": "string",
      "pricePerUnit": "string",
      "amount": "string",
      "taxAmount": "string"
    }
  ],
  "taxAmount": "string",
  "feeAmount": "string",
  "notes": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|returnId|string|true|none|none|
|supplierReferenceNumber|string|false|none|none|
|lines|[[CreateDebitNoteLineDto](#schemacreatedebitnotelinedto)]|true|none|none|
|taxAmount|string|false|none|none|
|feeAmount|string|false|none|none|
|notes|string|false|none|none|

<h2 id="tocS_CreateLocationDto">CreateLocationDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatelocationdto"></a>
<a id="schema_CreateLocationDto"></a>
<a id="tocScreatelocationdto"></a>
<a id="tocscreatelocationdto"></a>

```json
{
  "code": "string",
  "name": "string",
  "addressLine1": "string",
  "city": "string",
  "state": "string",
  "country": "string",
  "postCode": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|code|string|true|none|none|
|name|string|true|none|none|
|addressLine1|string|false|none|none|
|city|string|false|none|none|
|state|string|false|none|none|
|country|string|false|none|none|
|postCode|string|false|none|none|

<h2 id="tocS_CreateZoneDto">CreateZoneDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatezonedto"></a>
<a id="schema_CreateZoneDto"></a>
<a id="tocScreatezonedto"></a>
<a id="tocscreatezonedto"></a>

```json
{
  "locationId": "1a5515a3-ba81-4a42-aee7-ad9ffc090a54",
  "code": "string",
  "name": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|locationId|string(uuid)|true|none|none|
|code|string|true|none|none|
|name|string|true|none|none|

<h2 id="tocS_CreateBinDto">CreateBinDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatebindto"></a>
<a id="schema_CreateBinDto"></a>
<a id="tocScreatebindto"></a>
<a id="tocscreatebindto"></a>

```json
{
  "zoneId": "c3920607-5069-4ac3-ba10-00754e7a8e8b",
  "binNumber": "string",
  "binType": "storage",
  "isConsignment": true,
  "isBonded": true,
  "isUnavailable": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|zoneId|string(uuid)|true|none|none|
|binNumber|string|true|none|none|
|binType|string|false|none|none|
|isConsignment|boolean|false|none|none|
|isBonded|boolean|false|none|none|
|isUnavailable|boolean|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|binType|storage|
|binType|pick|
|binType|bulk|
|binType|receiving|
|binType|staging|
|binType|quarantine|
|binType|in_transit|

<h2 id="tocS_TestAbmConnectionDto">TestAbmConnectionDto</h2>
<!-- backwards compatibility -->
<a id="schematestabmconnectiondto"></a>
<a id="schema_TestAbmConnectionDto"></a>
<a id="tocStestabmconnectiondto"></a>
<a id="tocstestabmconnectiondto"></a>

```json
{
  "host": "string",
  "database": "string",
  "username": "string",
  "password": "string",
  "port": 1
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|host|string|true|none|none|
|database|string|true|none|none|
|username|string|true|none|none|
|password|string|true|none|none|
|port|number|false|none|none|

<h2 id="tocS_TestOdooConnectionDto">TestOdooConnectionDto</h2>
<!-- backwards compatibility -->
<a id="schematestodooconnectiondto"></a>
<a id="schema_TestOdooConnectionDto"></a>
<a id="tocStestodooconnectiondto"></a>
<a id="tocstestodooconnectiondto"></a>

```json
{
  "host": "string",
  "database": "string",
  "username": "string",
  "password": "string",
  "port": 1
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|host|string|true|none|none|
|database|string|true|none|none|
|username|string|true|none|none|
|password|string|true|none|none|
|port|number|false|none|none|

<h2 id="tocS_ExecuteEltDto">ExecuteEltDto</h2>
<!-- backwards compatibility -->
<a id="schemaexecuteeltdto"></a>
<a id="schema_ExecuteEltDto"></a>
<a id="tocSexecuteeltdto"></a>
<a id="tocsexecuteeltdto"></a>

```json
{
  "dbConfig": {
    "host": "string",
    "database": "string",
    "username": "string",
    "password": "string",
    "port": 0
  },
  "abmImport": true,
  "odooImport": true,
  "resumeExtraction": true,
  "skipExtraction": true,
  "defaultLocationCode": "string",
  "baseCurrency": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|dbConfig|object|false|none|none|
|» host|string|false|none|none|
|» database|string|false|none|none|
|» username|string|false|none|none|
|» password|string|false|none|none|
|» port|number|false|none|none|
|abmImport|boolean|false|none|none|
|odooImport|boolean|false|none|none|
|resumeExtraction|boolean|false|none|none|
|skipExtraction|boolean|false|none|none|
|defaultLocationCode|string|false|none|none|
|baseCurrency|string|false|none|none|

<h2 id="tocS_CreateGoodsReceivedLineDto">CreateGoodsReceivedLineDto</h2>
<!-- backwards compatibility -->
<a id="schemacreategoodsreceivedlinedto"></a>
<a id="schema_CreateGoodsReceivedLineDto"></a>
<a id="tocScreategoodsreceivedlinedto"></a>
<a id="tocscreategoodsreceivedlinedto"></a>

```json
{
  "productId": "string",
  "quantityReceived": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|productId|string|true|none|none|
|quantityReceived|string|true|none|none|

<h2 id="tocS_CreateGoodsReceivedDto">CreateGoodsReceivedDto</h2>
<!-- backwards compatibility -->
<a id="schemacreategoodsreceiveddto"></a>
<a id="schema_CreateGoodsReceivedDto"></a>
<a id="tocScreategoodsreceiveddto"></a>
<a id="tocscreategoodsreceiveddto"></a>

```json
{
  "vendorId": "string",
  "locationId": "string",
  "packingSlipNumber": "string",
  "notes": "string",
  "lines": [
    {
      "productId": "string",
      "quantityReceived": "string"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|vendorId|string|true|none|none|
|locationId|string|true|none|none|
|packingSlipNumber|string|false|none|none|
|notes|string|false|none|none|
|lines|[[CreateGoodsReceivedLineDto](#schemacreategoodsreceivedlinedto)]|true|none|none|

<h2 id="tocS_ResolveAllocationDto">ResolveAllocationDto</h2>
<!-- backwards compatibility -->
<a id="schemaresolveallocationdto"></a>
<a id="schema_ResolveAllocationDto"></a>
<a id="tocSresolveallocationdto"></a>
<a id="tocsresolveallocationdto"></a>

```json
{
  "purchaseOrderLineId": "string",
  "allocatedQuantity": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|purchaseOrderLineId|string|true|none|none|
|allocatedQuantity|string|false|none|none|

<h2 id="tocS_CreateMacroDto">CreateMacroDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatemacrodto"></a>
<a id="schema_CreateMacroDto"></a>
<a id="tocScreatemacrodto"></a>
<a id="tocscreatemacrodto"></a>

```json
{
  "name": "string",
  "macroType": "string",
  "content": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|true|none|none|
|macroType|string|false|none|none|
|content|string|true|none|none|

<h2 id="tocS_UpdateMacroDto">UpdateMacroDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatemacrodto"></a>
<a id="schema_UpdateMacroDto"></a>
<a id="tocSupdatemacrodto"></a>
<a id="tocsupdatemacrodto"></a>

```json
{
  "name": "string",
  "macroType": "string",
  "content": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|false|none|none|
|macroType|string|false|none|none|
|content|string|false|none|none|

<h2 id="tocS_CreateUserDto">CreateUserDto</h2>
<!-- backwards compatibility -->
<a id="schemacreateuserdto"></a>
<a id="schema_CreateUserDto"></a>
<a id="tocScreateuserdto"></a>
<a id="tocscreateuserdto"></a>

```json
{
  "username": "string",
  "password": "string",
  "role": "admin",
  "displayName": "string",
  "email": "user@example.com"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|username|string|true|none|none|
|password|string|true|none|none|
|role|string|true|none|none|
|displayName|string|false|none|none|
|email|string(email)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|role|admin|
|role|viewer|
|role|sales|
|role|warehouse|
|role|procurement|
|role|finance|

<h2 id="tocS_UpdateUserDto">UpdateUserDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdateuserdto"></a>
<a id="schema_UpdateUserDto"></a>
<a id="tocSupdateuserdto"></a>
<a id="tocsupdateuserdto"></a>

```json
{
  "password": "string",
  "role": "admin",
  "displayName": "string",
  "email": "user@example.com"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|password|string|false|none|none|
|role|string|false|none|none|
|displayName|string|false|none|none|
|email|string(email)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|role|admin|
|role|viewer|
|role|sales|
|role|warehouse|
|role|procurement|
|role|finance|

<h2 id="tocS_CreateDiscountMatrixDto">CreateDiscountMatrixDto</h2>
<!-- backwards compatibility -->
<a id="schemacreatediscountmatrixdto"></a>
<a id="schema_CreateDiscountMatrixDto"></a>
<a id="tocScreatediscountmatrixdto"></a>
<a id="tocscreatediscountmatrixdto"></a>

```json
{
  "customerGroupId": "2dd84b21-d83b-43ae-b968-ef03d5123a21",
  "customerId": "87d8e330-2878-4742-a86f-dbbb3bf522ac",
  "productGroupId": "c416ccc2-c7d5-4733-9136-58a3b93937ed",
  "discountPercentage": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|customerGroupId|string(uuid)|false|none|none|
|customerId|string(uuid)|false|none|none|
|productGroupId|string(uuid)|false|none|none|
|discountPercentage|string|true|none|none|

<h2 id="tocS_UpdateDiscountMatrixDto">UpdateDiscountMatrixDto</h2>
<!-- backwards compatibility -->
<a id="schemaupdatediscountmatrixdto"></a>
<a id="schema_UpdateDiscountMatrixDto"></a>
<a id="tocSupdatediscountmatrixdto"></a>
<a id="tocsupdatediscountmatrixdto"></a>

```json
{
  "discountPercentage": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|discountPercentage|string|false|none|none|

