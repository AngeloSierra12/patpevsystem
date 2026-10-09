// search only looks at the rows already on this page, no database yet

var form = document.getElementById("filter");
var search = document.getElementById("search");
var rows = document.querySelectorAll("table tr");

function searchRows() {
    var text = search.value.toLowerCase();

    for (var i = 1; i < rows.length; i++) {
        if (rows[i].textContent.toLowerCase().indexOf(text) == -1) {
            rows[i].style.display = "none";
        } else {
            rows[i].style.display = "";
        }
    }
}

form.addEventListener("submit", function (e) {
    e.preventDefault();
    searchRows();
});
search.addEventListener("input", searchRows);
