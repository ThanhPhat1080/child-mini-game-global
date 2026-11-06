Feedback phase 04.1:

# Khu vực Super Admin:
- Parents:
    - View được danh sách Parent sắp xếp theo CreatedAt & Alphabet. Có tính năng Search theo tên Parent hoặc tên của Children. Có nút kèm icon "message", khi có parent nào gửi message feedback thì thêm 1 dot red badget lên trên icon message để tôi được biết. Khi tôi ấn vào thì filter những parent đang có pending message.
    - Hiển thị "Tên Parent (dòng trên, text Bold), hạn mức sử dụng storage (một thanh volume, khi dưới 70% thì green, khi trên 70% thì orange, trên 85% thì red) hiển thị số mb usage rounding fixed 0, Children: 5 (dòng dưới, chữ nhỏ hơn, nhạt hơn)". Có nút để "expand all". Parent đang có pending message thì có icon message cùng badget dot red nhỏ
    - Có nút create new Parent và children thuộc parent đó (Super admin chỉ có quyền Ban, không có quyền edit/remove parent)
    - Có collapse/expand để coi tiếp được children của họ. Ai đang "Ban" sẽ có label chữ màu đỏ border màu đỏ "Ban". Click vào mũi tên icon để expand/collapse,  click vào parent name để view detail parent 
    - trang Parent detail
        - Thấy được tên, quota usage, danh sách children (dùng lại thẻ child của Parent admin page). 
        - Super admin có quyền Ban Parent
        - Super admin có thể thêm / xóa / edit thông tin của child (dùng lại component đã có ở Parent admin page)
        - Super admin có thể VIEW ONLY những màn chơi created bởi parent unpublished và published. Click vào đến page detail màn chơi đó nhưng view only nhé
- Children:
    - View được danh sách children sắp xếp theo CreatedAt & Alphabet. Có tính năng Search theo child login name, child display name , Parent name. 
    - Hiển thị: Giống card Children component đã có ở Parent admin page. nhưng to hơn và mở rộng thêm Tên parent (dòng dưới, text medium) (Nếu parent đang bị ban thì hiển thị thêm tag Ban nhỏ bên cạnh tên parent). Click vào tên Parent sẽ navigate đến Parent detail page đã đề cập ở trên.
    - Hiển thị danh sách children theo dạng table 2 columns. Vẫn giữ thiết kế để phân biệt boy/girl
    - tính năng edit/remove child vẫn như parent admin page.

- All content -> Remove please
- Messages: Icon có badget dot red nhỏ nếu còn pending message hiển thị ở sidebar
  - trang này dạng tab. Design đã có, dùng lại
    - Tab: Pending message
        - hiển thị danh sách pending message (dùng lại parent items từ trang parent)
        - Sort by message createdAt, parent name
        - search by parent name
    - Tab: history
        - hiển thị danh sách messages đã xử lý
        - Sort by message createdAt, parent name
        - search by parent name
- Review queue không phải là một page riêng
    - Mỗi trò chơi ở "Game settings" đều có tab "Review Queue"; super admin sẽ vào đây và xem. Khi vẫn còn có item đang pending ở queue thì có badget dot red nhỏ trên icon của trò chơi. super admin sẽ phải duyệt hoặc không duyệt pending item. Khi không còn pending item thì không còn dot red.
    - Mỗi trò chơi ở "Game settings" đều có tab "Parent published"; Super admin view được tất cả published game của tất cả parents. View only - not allow edit.
    - Super admin có quyền chỉnh sửa tất cả màn chơi trò chơi của họ hoặc sau khi publish global từ parent !important. Publish global thì nên copy một bản sao, không reference đến original của Parent vì super admin có thể chỉnh sửa sau đó. 

