-- =============================================================================
-- HOTEL INVENTORY SYSTEM FOR IGP PATVEP HOSTEL AND UNIVERSITY CANTEEN
-- Database: bpsu_patvep_inventory
-- File: 01_database.sql
-- Purpose: Create the database
-- Target: MariaDB 10.4 (XAMPP)
--
-- New name on purpose: the old reservation-era database `bpsu_patvep` is left
-- untouched so the two can never be confused.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS bpsu_patvep_inventory
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE bpsu_patvep_inventory;

SET NAMES utf8mb4;
SET time_zone = '+08:00'; -- PH Standard Time
