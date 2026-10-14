<?php

require __DIR__ . '/_common.php';
allow_methods(['GET']);

respond(['user' => public_user(require_login())]);
