<?php

namespace App\Controllers;

use CodeIgniter\RESTful\ResourceController;

class ApiBridge extends ResourceController
{
    private $backendUrl = "http://127.0.0.1:8000/api";

    public function index()
    {
        // Contoh fetch data dashboard dari backend FastAPI
        $client = \Config\Services::curlrequest();
        try {
            $response = $client->request('GET', $this->backendUrl . '/system-stats', [
                'headers' => ['Accept' => 'application/json']
            ]);
            $data = json_decode($response->getBody(), true);
            return $this->respond($data);
        } catch (\Exception $e) {
            return $this->fail('Backend unreachable: ' . $e->getMessage());
        }
    }
}
